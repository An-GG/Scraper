// mwc.js
// Multi - Worker Collaboration
// Copyright (c) Ankush Girotra 2019. All rights reserved.

var fb = null;
var WORKER_ID = ""
const SERVERCOMM_REF = 'servercomm';
const DATA_REF = 'data';

const MSEC_BETWEEN_CHECKIN = 300000; // 5 Minutes
const MSEC_BETWEEN_TIMEOUT = 360000; // 6 Minutes


async function initializeApp(workerid, firebase) {
  WORKER_ID = workerid;
  fb = firebase;
}

var workers = {};

// Tracks Other Workers To Ensure Check In
async function trackWorkers() {
  let workersRef = fb.database().ref(SERVERCOMM_REF + "/workers");
  workersRef.on('child_added', function(snap, key) {
    let worker = snap.val();
    workers[snap.key] = worker;
    checkWorkerTimeout(worker);
  });
  workersRef.on('child_removed', function(snap) {
    delete workers[snap.key];
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

async function checkWorker(workerID) {
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
    setTimeout(checkWorker, MSEC_BETWEEN_TIMEOUT, worker.workerID);
  }
}

async function deleteWorker(workerID) {
  let workerRef = fb.database().ref(SERVERCOMM_REF + "/workers/" + workerID);
  await workerRef.remove();
  // TODO: Remove worker from scraper pool
}







 // Scraper

 var clients = {};
 var assignedClients = {};

async function synchronizeClients() {
  let clientsRef = fb.database().ref('hisd_clients');

  await clientsRef.on('child_added', async function (snap, prevKey) {
    let val = snap.val();
    clients[snap.key] = val;
    console.log(clients);
    taskRefactor();
  });

  await clientsRef.on('child_removed', async function (snap) {
    delete clients[snap.key];
    taskRefactor();
  });
  // TODO:  Check for collisions between child removed and changed, also add boundaries for needed checks only
  await clientsRef.on('child_changed', async function (snap, prevKey) {
    let val = snap.val();
    clients[snap.key] = val;
  });
}

async function taskRefactor() {
  // Get Scraper Data
  // TODO: Decide Which Workers Will Work or Scrape or Both
  let scrapers =  workers;
  let scraperWorkersIDs = Object.keys(scrapers);

  // Get Number Of Scrapers
  let numberOfScrapers = scraperWorkersIDs.length;

  // Get Worker's Place In List
  let sorted = scraperWorkersIDs.sort(sortAlphaNum);
  var scraperNumber = -1;
  for (var SCRAPER_N = 0; SCRAPER_N < sorted.length; SCRAPER_N++) {
    if (sorted[SCRAPER_N] == WORKER_ID) {
      scraperNumber = SCRAPER_N;
    }
  }

  // Get Sorted Clients List
  let sortedClientsList = (Object.keys(clients)).sort(sortAlphaNum);
  let numberOfClients = sortedClientsList.length;

  // Number Of Clients Per Woker
  let numberOfClientsPerWorker = Math.ceil(numberOfClients/numberOfScrapers);

  // Cycle Through Clients To Get Assigned Clients
  let startingIndex = scraperNumber * numberOfClientsPerWorker;
  assignedClients = {};
  for (var i = 0; i < numberOfClientsPerWorker; i++) {
    let clientID = sortedClientsList[i + startingIndex];
    if (clientID != null) {
      let client = clients[clientID];
      assignedClients[clientID] = client;
    }
  }
}



// Assistants

var reA = /[^a-zA-Z]/g;
var reN = /[^0-9]/g;

function sortAlphaNum(a, b) {
  var aA = a.replace(reA, "");
  var bA = b.replace(reA, "");
  if (aA === bA) {
    var aN = parseInt(a.replace(reN, ""), 10);
    var bN = parseInt(b.replace(reN, ""), 10);
    return aN === bN ? 0 : aN > bN ? 1 : -1;
  } else {
    return aA > bA ? 1 : -1;
  }
}




// EXPORTS
module.exports = {
  initializeApp: initializeApp,
  trackWorkers: joinWorkers,
  checkIn: checkIn,
  synchronizeClients: synchronizeClients,
  assignedClients: assignedClients
};
