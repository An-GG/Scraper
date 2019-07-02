// deepDifference.js
// Identify Differences In JS Objects
// Copyright (c) Ankush Girotra 2019. All rights reserved.

var deepDiffMapper = function () {
  return {
    VALUE_CREATED: 'created',
    VALUE_UPDATED: 'updated',
    VALUE_DELETED: 'deleted',
    VALUE_UNCHANGED: 'unchanged',
    map: function(obj1, obj2) {
      if (this.isFunction(obj1) || this.isFunction(obj2)) {
        throw 'Invalid argument. Function given, object expected.';
      }
      if (this.isValue(obj1) || this.isValue(obj2)) {
        var returnVal = {
          type: this.compareValues(obj1, obj2),
          data: obj1 === undefined ? obj2 : obj1,
          isChangelogDirectory: "YES"
        };
        if (returnVal.type != this.VALUE_UNCHANGED) {
        	return returnVal;
        } else {
        	return returnVal;
        }
      }

      var diff = {};
      for (var key in obj1) {
        if (this.isFunction(obj1[key])) {
          continue;
        }

        var value2 = undefined;
        if (obj2[key] !== undefined) {
          value2 = obj2[key];
        }

        diff[key] = this.map(obj1[key], value2);
      }
      for (var key in obj2) {
        if (this.isFunction(obj2[key]) || diff[key] !== undefined) {
          continue;
        }

        diff[key] = this.map(undefined, obj2[key]);
      }

      return diff;

    },
    compareValues: function (value1, value2) {
      if (value1 === value2) {
        return this.VALUE_UNCHANGED;
      }
      if (this.isDate(value1) && this.isDate(value2) && value1.getTime() === value2.getTime()) {
        return this.VALUE_UNCHANGED;
      }
      if (value1 === undefined) {
        return this.VALUE_CREATED;
      }
      if (value2 === undefined) {
        return this.VALUE_DELETED;
      }
      return this.VALUE_UPDATED;
    },
    isFunction: function (x) {
      return Object.prototype.toString.call(x) === '[object Function]';
    },
    isArray: function (x) {
      return Object.prototype.toString.call(x) === '[object Array]';
    },
    isDate: function (x) {
      return Object.prototype.toString.call(x) === '[object Date]';
    },
    isObject: function (x) {
      return Object.prototype.toString.call(x) === '[object Object]';
    },
    isValue: function (x) {
      return !this.isObject(x) && !this.isArray(x);
    }
  }
}();

function cleanUp(updates) {
	var cleaned = JSON.parse(JSON.stringify(updates));
  for (let key of Object.keys(cleaned)) {
  	let val = cleaned[key];
    if (val.isChangelogDirectory == 'YES') {
    	if (val.type == 'unchanged') {
      	delete cleaned[key];
      }
      if (val.type == 'created') {
        if (Object.keys(val.data).length == 0) {
          delete cleaned[key];
        }
      }
    } else {
    	cleaned[key] = cleanUp(cleaned[key]);
      if (Object.keys(cleaned[key]).length == 0) {
      	delete cleaned[key];
      }
    }
  }
  return cleaned;
}


function rebuild(initial, updates) {
	var final = JSON.parse(JSON.stringify(initial));
  for (let key of Object.keys(updates)) {
		let val = updates[key];
    if (val.isChangelogDirectory == 'YES') {
    	let type = val.type;
      if (type == 'created') {
      	delete final[key];
      } else {
      	final[key] = val.data;
      }
    } else {
    	final[key] = rebuild(final[key], updates[key]);
    }
  }
  return final;
}

function getChanges(initial, current) {
  return cleanUp(deepDiffMapper.map(initial, current));
}



// EXPORTS

module.exports = {
  getChanges: getChanges,
  rebuild: rebuild
}
