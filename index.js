const express = require('express');
const { google } = require('googleapis');
const { Client } = require('@line/bot-sdk');
const bodyParser = require('body-parser');
const axios = require('axios');

const app = express();

const LINE_CONFIG = {
    channelAccessToken: 'hadK35EKm6TJVQQEpmVRC3g7oXsVkE8p3BaqPdH2J5K9Jo2awyBgdMcCbQTNADkypKlp8WdF/XFzmY+vNfsCdfOVrIursPQ2DpXEAcbU9jrd6Adjr2iyEXcDp/JTz2OsX850osx/C1bRpz6QeU+AFAdB04t89/1O/w1cDnyilFU=',
    channelSecret: 'b7b8d4e0a2d81748b6311faf74451e62'
};

const client = new Client(LINE_CONFIG);

const sheets = google.sheets('v4');
const GOOGLE_SHEET_ID = '1xWM0fj8a8-6O--XiSxpT6ZQMS7JAOSrHv_yySn45cSM';
const GOOGLE_SHEET_RANGE = 'หวย-12A!A1'; // Adjust accordingly

const serviceAccount = require('./credentials.json');
const jwtClient = new google.auth.JWT({
    email: serviceAccount.client_email,
    key: serviceAccount.private_key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
});

app.use(bodyParser.json());

function getCurrentTimestamp() {
    const now = new Date();
    // Convert to UTC+8 timezone (which is 8 hours ahead of UTC)
    const utcPlus8Date = new Date(now.getTime() + (1 * 60 * 60 * 1000));

    // Format the date and time
    const options = {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false,
        timeZone: 'Asia/Bangkok'  // Bangkok is in the UTC+7 timezone, but we've already added an hour above
    };
    return new Intl.DateTimeFormat('en-US', options).format(utcPlus8Date);
}

app.post('/webhook', (req, res) => {
  const events = req.body.events;

    const timestamp = getCurrentTimestamp();

  if (events) {
    events.forEach((event) => {
        if (event.type === 'memberJoined' && event.source.type === 'group') {
            const groupId = event.source.groupId;
            const members = event.joined.members;

            members.forEach(member => {
                const userId = member.userId;
                const customUrl = `https://api.line.me/v2/bot/group/${groupId}/member/${userId}`;

                axios.get(customUrl, {
                    headers: {
                        'Authorization': `Bearer ${LINE_CONFIG.channelAccessToken}`,
                    }
                })
                .then(response => {
                    const profile = response.data;

                    jwtClient.authorize((err, tokens) => {
                        if (err) {
                            console.error(err);
                            return;
                        }

                        sheets.spreadsheets.values.append({
                            auth: jwtClient,
                            spreadsheetId: GOOGLE_SHEET_ID,
                            range: GOOGLE_SHEET_RANGE,
                            valueInputOption: 'RAW',
                            insertDataOption: 'INSERT_ROWS',
                            resource: {
                                values: [[timestamp,profile.userId,profile.displayName,profile.pictureUrl, 'เข้าร่วมกลุ่ม']]
                            }
                        }, (err, response) => {
                            if (err) {
                                console.error('The API returned an error: ' + err);
                            } else {
                                console.log('Profile appended:', response.data.updates.updatedCells);
                            }
                        });
                    });
                })
                .catch(error => {
                    console.error('Error calling the LINE API: ', error);
                });
            });
        } else if (event.type === 'memberLeft' && event.source.type === 'group') {
            const groupId = event.source.groupId;
            const members = event.left.members;

            members.forEach(member => {
                const userId = member.userId;

                jwtClient.authorize((err, tokens) => {
                    if (err) {
                        console.error(err);
                        return;
                    }

                    sheets.spreadsheets.values.append({
                        auth: jwtClient,
                        spreadsheetId: GOOGLE_SHEET_ID,
                        range: GOOGLE_SHEET_RANGE,
                        valueInputOption: 'RAW',
                        insertDataOption: 'INSERT_ROWS',
                        resource: {
                            values: [[timestamp,userId,'-','-','ออกจากกลุ่ม']]
                        }
                    }, (err, response) => {
                        if (err) {
                            console.error('The API returned an error: ' + err);
                        } else {
                            console.log('Profile appended:', response.data.updates.updatedCells);
                        }
                    });
                });
            });
        }
    });
  } else {
    console.log('No events to process');
  }

  res.sendStatus(200);
  });

  app.listen(3000);