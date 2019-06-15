// main.js
// Lowest Level Scraping Function
// Copyright (c) Ankush Girotra 2019. All rights reserved.

const puppeteer = require('puppeteer');
const innertext = require('innertext');


const PSCONNECT_URL = "https://publicapps.houstonisd.org/ParentStudentConnect/Login.aspx";
const GRADEFRAME_URL = "https://parent.gradebook.houstonisd.org/pc/StudentMain.aspx";
async function getData(input_username, input_password) {

  // SETUP, USE SINGLE BROWSER INSTANCE LATER
  const browser = await puppeteer.launch({
    headless: false
  });
  const page = await browser.newPage();
  page.setViewport({
    width: 1000,
    height: 1000
  });

  // NEW PAGE FOR USER
  await page.goto(PSCONNECT_URL);

  // LOGIN USING GIVEN CREDENTIALS
  await page.type("#ctl00_ContentArea_txtUserName", input_username);
  await page.type("#ctl00_ContentArea_txtPassword", input_password);
  const passwordField = await page.$("#ctl00_ContentArea_txtPassword");
  await passwordField.press('Enter');

  // WAIT FOR AND CLICK GRADEBOOK BUTTON
  // Note: Gradebook launch button is clicked to authenticate realistic login.
  await page.waitForSelector('#ctl00_ContentArea_Btn_Gradebook');
  await page.click('#ctl00_ContentArea_Btn_Gradebook');

  // WAIT FOR GRADEBOOK FRAME
  await page.waitForSelector('#ctl00_ContentArea_frame_GS'); //iframe now exists, but has not loaded grades yet
  const gradeframe = await page.mainFrame().childFrames()[0]; // Assumes first child frame is the gradeframe
  await gradeframe.waitForNavigation(); // Waits for the gradeframe to navigate to the gradeframe url
  // CACHE TO AUTHENTICATE IS IN PLACE, NAVIGATE TO GRADEBOOK
  await page.goto(GRADEFRAME_URL);


  // ClICK GRADES BUTTON
  await page.waitForSelector('#lnkGrades');
  await page.click('#lnkGrades');

  /////////////////////////////////////
  ///// VARIABLE STRUCTURE MARKER /////
  // STRUCTURE MAY VARY FOR SCHOOLS  //
  /////////////////////////////////////

  // Approach: Use HTML content to parse grid information, assume standard structure for selectors
  const HTML_CONTENT = await page.content();

  // Assuming: Row structure as TEACHER | NOTES | COURSE | PERIOD | CYCLE1 | CYCLE2 | EXAM1 | SEM1 | CYCLE3 | CYCLE4 | EXAM2 | SEM2

  // Gather Table Metadata
  var tabledata = {};
  var nonEmptyCells = [];

  // Parses out individual rows of the table (or classes)
  const HTML_Rows = HTML_CONTENT.match(/<tr class="DataRow.*?<\/tr>/gs);
  tabledata.n_classes = HTML_Rows.length;

  for (var TABLE_Y = 0; TABLE_Y < HTML_Rows.length; TABLE_Y++) {
    let HTML_Row = HTML_Rows[TABLE_Y];
    var row = {};

    let teacherName = HTML_Row.match(/(?<=(TeacherNameCell">)).*?(?=(<\/th))/)[0];
    row['TEACHER'] = teacherName;

    // Cells Parsed Out From <td>. Teacher name cell is in <th> so this is everything after that.
    const HTML_Cells = HTML_Row.match(/<td.*?<\/td>/gs);
    let assumedStructure = ['NOTES', 'COURSE', 'PERIOD', 'CYCLE1', 'CYCLE2', 'EXAM1', 'SEM1', 'CYCLE3', 'CYCLE4', 'EXAM2', 'SEM2'];

    // Cycle Through Each Cell
    for (var TABLE_X = 1; TABLE_X < HTML_Cells.length; TABLE_X++) { // Starting at 1 to skip notes
      let cellTitle = assumedStructure[TABLE_X];
      let content = innertext(HTML_Cells[TABLE_X]);
      row[cellTitle] = content;

      // Flag Non-Empty Cells
      if (cellTitle.includes('CYCLE') && content != ' ') {
        let flaggedCell = {
          cellTitle: cellTitle,
          row: "TABLEROW_" + TABLE_Y,
          selectorRow: TABLE_Y + 2,
          selectorCell: TABLE_X + 2
        }
        nonEmptyCells.push(flaggedCell);
      }
    }

    tabledata["TABLEROW_" + TABLE_Y] = row;

  }



  /////////////////////////////////////




}



// TESTING
getData("STUDENT\\s1620641", "YellowRiver812");
