var AsyncArray = require('./')

var items = new AsyncArray([1, 2, 'three', 4])

items
  .map(function (item, i, next) {
    setTimeout(next, 1000, null, 'did ' + i)
  })
  .done(function (error, results) {
    console.log('map', results)
  })
  .exec()

items
  .mapSerial(function (item, i, next) {
    setTimeout(next, 1000, null, 'did ' + i)
  })
  .done(function (error, results) {
    console.log('mapSerial', results, results.length)
  })
  .exec()

items
  .filter(function (item, i, next) {
    setTimeout(function () {
      if ('string' === typeof item) {
        return next()
      }
      next(null, true)
    }, 1000)
  }) 
  .done(function (error, results) {
    console.log('filter', results)
  })
  .exec()

items
  .forEachSerial(function (item, i, next) {
    setTimeout(function () {
      console.log('forEachSerial', i, item)
      next()
    }, 1000)
  })
  .exec()
