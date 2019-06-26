// mwc.js
// Multi - Worker Collaboration
// Copyright (c) Ankush Girotra 2019. All rights reserved.

var fb = null;
var WORKER_ID = ""
const SERVERCOMM_REF = 'servercomm';
const DATA_REF = 'data';

const MSEC_BETWEEN_CHECKIN = 3000; // 5 Minutes
const MSEC_BETWEEN_TIMEOUT = 3600; // 6 Minutes


async function initializeApp(workerid, firebase) {
  WORKER_ID = workerid;
  fb = firebase;
}

// Joins Worker Labor Pool
async function joinWorkers() {
  await checkIn();

  let workersRef = fb.database().ref(SERVERCOMM_REF + "/workers");
  workersRef.once('child_added', function(snap, key) {
    let worker = snap.val();
    checkWorkerTimeout(worker);
  })
}

// Recursive Check In Function Checks In Every 5 Minutes
async function checkIn() {
  let workerRef = fb.database().ref(SERVERCOMM_REF + "/workers/" + WORKER_ID);
  let timestamp = (new Date() * 1); // In milliseconds unix time
  workerRef.set({
    lastCheckIn: timestamp,
    workerID: WORKER_ID
  });
  setTimeout(checkIn, MSEC_BETWEEN_CHECKIN);
}

async function getWorkerData(workerID) {
  let workerRef = fb.database().ref(SERVERCOMM_REF + "/workers/" + workerID);
  workerRef.once('value').then(function(snap){
    let val = snap.val();
    checkWorkerTimeout(val);
  });
}

async function checkWorkerTimeout(worker) {
  let currentTime = (new Date() * 1);
  let timeDelta = currentTime - worker.lastCheckIn;
  if (timeDelta > MSEC_BETWEEN_TIMEOUT) {
    deleteWorker(worker.workerID);
  } else {
    // Schedule Another Check
    setTimeout(getWorkerData, MSEC_BETWEEN_TIMEOUT, worker.workerID);
  }
}

async function deleteWorker(workerID) {
  let workerRef = fb.database().ref(SERVERCOMM_REF + "/workers/" + workerID);
  await workerRef.remove();
}



// EXPORTS
module.exports = {
  initializeApp: initializeApp,
  joinWorkers: joinWorkers
};
