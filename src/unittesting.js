// unittesting.js
// Testing For Scraper
// Copyright (c) Ankush Girotra 2019. All rights reserved.

/*var corescraper = require("./corescraper.js");
var signup = require("./signupflow.js");
var fb = require('firebase-admin');
var tokens = require('./tokens.js');
var serviceAccount = require("./../echelon-f16f8-firebase-adminsdk-ytuzc-7e23c999b7.json");
*/
var fakedb = require('./databasesnap.json');

// Initialize
async function initializeApp() {
  await fb.initializeApp({
    credential: fb.credential.cert(serviceAccount),
    databaseURL: "https://echelon-f16f8.firebaseio.com/"
  });
}

async function simulateUserSignup(FB_ID, PSC_ID, PSC_PASS) {
  await initializeApp();

  var signup_ref = await fb.database().ref('servercomm/signup');

  var signupObject = {
    FB_ID: FB_ID,
    PSC_ID: PSC_ID,
    PSC_PASS: PSC_PASS
  };

  var signup_user_ref = await signup_ref.child(FB_ID);

  await monitorRefActivity(signup_user_ref);
  await signup_user_ref.set(signupObject);
}



async function monitorRefActivity(REF) {
  REF.on('value', async function(snap){
    await console.log(snap.val());
  });
}

//simulateUserSignup('parentuser', tokens.SAMPLES.PARENTID, tokens.SAMPLES.PARENTPW);


let obj1 = {
  name: "John",
  date: "12-12-12",
  times: [12,12,12],
  son: {
    name: "JJ Junior",
    date: "12-01-01"
  },
  point: 1
}

let obj2 = {
  name: "Jon",
  date: "12-12-12",
  times: [12,12,12],
  son: {
    name: "VV Junior",
    date: "12-01-01"
  },
  newData: "test"
}


function updateObject(time, pathArr, updateType, value) {
  return {
    time: time,
    path: pathArr,
    updateType: updateType,
    value: value
  }
  /*
  Update Type Should Be .created, .changed, .deleted
  */
}

// Gets Differences on Current Level
function getUpdates(oldObject, newObject, appendPath) {

  var updates = [];
  var subObjects = [];
  // Check For Objects that have been deleted or changed by checking every directory of old in new
  for (var oldObjectKey in oldObject) {
    var newPath = JSON.parse(JSON.stringify(appendPath));
    newPath.push(oldObjectKey)
    if (newObject[oldObjectKey] != oldObject[oldObjectKey]) {
      if (newObject[oldObjectKey] == undefined) {
        // Key not found in new object, object was deleted
        updates.push(updateObject("TIME", newPath, "deleted", ""));
      } else {
        // Object is either different or is js object that needs to be looked at further (is subobject)
        if (typeof newObject[oldObjectKey] == "object" && typeof oldObject[oldObjectKey] == "object") {
          // the new value is a subobject, so it needs to be looked at deeper
          let subUpdates = getUpdates(oldObject[oldObjectKey], newObject[oldObjectKey], newPath);
          Array.prototype.push.apply(updates,subUpdates);
        } else {
          // the new object is just different, so we found a change
          updates.push(updateObject("TIME", newPath, "changed", newObject[oldObjectKey]));
        }
      }
    }
  }

  // Code to get created data
  function getCreatedUpdatesInDir(oldOb, newOb, appPath) {
    var createdUpdates = [];
    for (newObjectKey in newOb) {
      var newPath = JSON.parse(JSON.stringify(appPath));
      newPath.push(newObjectKey)
      if (newOb[newObjectKey] != oldOb[newObjectKey]) {
        // Data was either created, changed, or the current directory is an Object
        if (typeof newOb[newObjectKey] == "object" && typeof oldOb[newObjectKey] == "object") {
          // current dir is an object, need to look deeper
          let subCreatedUpdates = getCreatedUpdatesInDir(oldOb[newObjectKey], newOb[newObjectKey], newPath);
          Array.prototype.push.apply(createdUpdates,subCreatedUpdates);
        } else {
          // object was just changed or created
          if (oldOb[newObjectKey] == undefined) {
            // object was created
            createdUpdates.push(updateObject("TIME", newPath, "created", newOb[newObjectKey]));
          }
        }
      }
    }
    return createdUpdates;
  }

  Array.prototype.push.apply(updates, getCreatedUpdatesInDir(oldObject, newObject, appendPath));

  return updates;
}


function rebuildFromUpdates(oldObject, updates) {
  var workingObject = JSON.parse(JSON.stringify(oldObject));

  const getNestedObject = (nestedObj, pathArr) => {
    return pathArr.reduce((obj, key) =>
        (obj && obj[key] !== 'undefined') ? obj[key] : undefined, nestedObj);
  }

  for (var updateKey in updates) {
    let update = updates[updateKey];

    var workingDir = getNestedObject(workingObject, update.path)

    console.log(workingDir);
    if (update.updateType == "deleted") {
      delete workingDir;
    } else {
      workingDir = update.value;
    }
  }

  return workingObject;
}

let ups = getUpdates(obj1, obj2, []);

console.log(ups);

let rb = rebuildFromUpdates(obj1, ups);

console.log(rb);
