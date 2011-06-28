// The MIT License
//
// Copyright (c) 2011 Tim Smart
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files
// (the "Software"), to deal in the Software without restriction,
// including without limitation the rights to use, copy, modify, merge,
// publish, distribute, sublicense, and/or sell copies of the Software, and
// to permit persons to whom the Software is furnished to do so, subject to
// the following conditions:
// 
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
// 
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
// IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
// CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
// TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
// SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

/**
 * Array for async operations
 *
 * @constructor
 * @extends {Array}
 * @param @optional {Array} arr : Base elements.
 */
function AsyncArray (arr) {
  Array.call(this)

  if (arr) {
    this.push.apply(this, arr)
  }
}

AsyncArray.prototype.__proto__ = Array.prototype

// Export
module.exports = AsyncArray

// Proxy methods to operations.
AsyncArray.prototype.forEach = function (callback) {
  return new Operation(this).forEach(callback)
}
AsyncArray.prototype.forEachSerial = function (callback) {
  return new Operation(this).forEachSerial(callback)
}
AsyncArray.prototype.map = function (callback) {
  return new Operation(this).map(callback)
}
AsyncArray.prototype.mapSerial = function (callback) {
  return new Operation(this).mapSerial(callback)
}
AsyncArray.prototype.filter = function (callback) {
  return new Operation(this).filter(callback)
}
AsyncArray.prototype.filterSerial = function (callback) {
  return new Operation(this).filterSerial(callback)
}

// --------------------

/**
 * Represents a async operation
 *
 * @constructor
 * @param {AsyncArray} array
 */
function Operation (array) {
  this.array = array
  this.steps = []
}

/**
 * Get the last added step
 *
 * @return {Step}
 */
Operation.prototype.lastStep = function () {
  return this.steps[this.steps.length - 1]
}

/**
 * Run the next step
 *
 * @param {OperState} state
 * @param {Error} error
 * @param {AsyncArray} result
 */
Operation.prototype._next = function (state, error, result) {
  if (error) {
    return
  }

  ++state.index
  if (this.steps[state.index]) {
    this.steps[state.index].run(state, result)
  }
}

/**
 * Add's a callback for the last step item
 *
 * @param {Function} callback
 */
Operation.prototype.done = function (callback) {
  this.lastStep().callbacks.push(callback)
  return this
}

/**
 * Iterates over the array.
 *
 * @param {Function} callback
 */
Operation.prototype.forEach = function (callback) {
  this.steps.push(new Step(this, callback))
  return this
}

/**
 * Iterates over the array. Serial.
 *
 * @param {Function} callback
 */
Operation.prototype.forEachSerial = function (callback) {
  this.steps.push(new Step(this, callback, true))
  return this
}

/**
 * Creates a new array from the results
 *
 * @param {Function} callback
 */
Operation.prototype.map = function (callback) {
  this.steps.push(new Map(this, callback))
  return this
}

/**
 * Creates a new array from the results. Serial.
 *
 * @param {Function} callback
 */
Operation.prototype.mapSerial = function (callback) {
  this.steps.push(new Map(this, callback, true))
  return this
}

/**
 * Filters an array
 *
 * @param {Function} callback
 */
Operation.prototype.filter = function (callback) {
  this.steps.push(new Filter(this, callback))
  return this
}

/**
 * Filters an array. Serial
 *
 * @param {Function} callback
 */
Operation.prototype.filterSerial = function (callback) {
  this.steps.push(new Filter(this, callback, true))
  return this
}

/**
 * Starts the operation
 */
Operation.prototype.exec = function () {
  var state = new OperState(this)
  this.steps[0].run(state, this.array)
  return this
}

// --------------------

/**
 * Keep track of things.
 *
 * @constructor
 * @param {Step} step
 * @param {AsyncArray} array
 * @param {AsyncArray} result
 */
function OperState (oper) {
  this.oper  = oper
  this.index = 0
}

// --------------------

/**
 * Reprensents a step in a operation
 *
 * @constructor
 * @param {Operation} oper
 * @param {Function} callback
 */
function Step (oper, callback, serial) {
  var step       = this
  this.oper      = oper
  this.callbacks = []
  this.callback  = callback
  this.serial    = serial || false
}

/**
 * Called when a iteration is done.
 *
 * @param {Error} error
 * @param @optional {Mixed} result
 */
Step.prototype.next = function (state, i, error, data) {
  if (state.done) {
    return
  }

  if (error) {
    state.done = true
    return this.done(error, state)
  }

  ++state.count

  if (this.serial) {
    if (state.count >= state.array.length) {
      state.done = true
      return this.done(null, state)
    }

    return this.callback(state.array[state.count], state.count, state.serialfn)
  }

  if (state.count >= state.array.length) {
    state.done = true
    this.done(null, state)
  }
}

/**
 * Called when the step is done.
 *
 * @param {Error} error
 * @param {StepState} state
 */
Step.prototype.done = function (error, state) {
  state.result = new AsyncArray(state.result)

  for (var i = 0, il = this.callbacks.length; i < il; i++) {
    this.callbacks[i].call(this.oper, error, state.result)
  }

  this.oper._next(state.oper_state, error, state.result)
}

/**
 * Get the party started
 *
 * @param {AsyncArray} array
 */
Step.prototype.run = function (oper_state, array) {
  var step  = this
    , state = new StepState(this, oper_state, array, [])

  if (this.serial) {
    state.serialfn = function (error, data) {
      step.next(state, state.count, error, data)
    }
    return this.callback(array[0], 0, state.serialfn)
  }

  Array.prototype.forEach.call(array, function (item, i) {
    step.callback(item, i, function (error, data) {
      step.next(state, i, error, data)
    })
  })
}

// --------------------

/**
 * Keep track of things.
 *
 * @constructor
 * @param {Step} step
 * @param {AsyncArray} array
 * @param {AsyncArray} result
 */
function StepState (step, oper_state, array, result) {
  this.step       = step
  this.oper_state = oper_state
  this.array      = array
  this.result     = result || array
  this.count      = 0
  this.done       = false
  this.serialfn   = null
}

// --------------------

/**
 * A map step
 *
 * @constructor
 * @extends {Step}
 * @param {Operation} oper
 * @param {Function} callback
 */
function Map (oper, callback, serial) {
  Step.call(this, oper, callback, serial)
}

// Inherit Step
Map.prototype.__proto__ = Step.prototype

/**
 * Called when a iteration is done.
 *
 * @param {Error} error
 * @param @optional {Mixed} result
 */
Map.prototype.next = function (state, i, error, data) {
  state.result[i] = data
  Step.prototype.next.call(this, state, i, error, data)
}

// --------------------

/**
 * A filter step
 *
 * @constructor
 * @extends {Step}
 * @param {Operation} oper
 * @param {Function} callback
 */
function Filter (oper, callback, serial) {
  Step.call(this, oper, callback, serial)
}

// Inherit Step
Filter.prototype.__proto__ = Step.prototype

/**
 * Sort function for filtered results
 *
 * @param {Number} a
 * @param {Number} b
 */
Filter.SORTFN = function (a, b) {
  return a - b
}

/**
 * Called when a iteration is done.
 *
 * @param {Error} error
 * @param @optional {Mixed} result
 */
Filter.prototype.next = function (state, i, error, data) {
  if (data === true) {
    state.result.push(i)
  }

  Step.prototype.next.call(this, state, i, error, data)
}

/**
 * When the step is done
 *
 * @param {Error} error
 * @param {StepState} state
 */
Filter.prototype.done = function (error, state) {
  if (!error && !this.serial) {
    var result = state.result.sort(Filter.SORTFN)
    state.result = []

    for (var i = 0, il = result.length; i < il; i++) {
      state.result.push(state.array[result[i]])
    }
  }

  Step.prototype.done.call(this, error, state)
}
