const fs = require('fs');
const readline = require('readline');
const { google } = require('googleapis');
const path = require('path');

const tokenPath = path.join(process.cwd(), 'token.json');

const oauth2Client = new google.auth.OAuth2(
  '325773506269-a9th9rvbi3pij6vi8mvapdqda3c5s0d9.apps.googleusercontent.com',
  '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',
  'http://localhost'
);

async function validateAuthToken(callback) {
console.log('Authenticating');
  try {
    if (fs.existsSync(tokenPath)) {
      const tokenData = JSON.parse(fs.readFileSync(tokenPath, 'utf-8'));
      oauth2Client.setCredentials(tokenData);

      const expiryDate = tokenData.expiry_date || 0;
      const now = Date.now();

      if (expiryDate > now) {
        console.log('Token is still valid.');
        return callback(null, tokenData);
      }

      if (tokenData.refresh_token) {
        console.log('Token expired, attempting to refresh...');
        const { credentials } = await oauth2Client.refreshAccessToken();
        oauth2Client.setCredentials(credentials);
        fs.writeFileSync(tokenPath, JSON.stringify(credentials));
        console.log('Token successfully refreshed.');
        return callback(null, credentials);
      } else {
        console.error('No refresh token available, re-authentication required.');
        return await authenticate(callback);
      }
    } else {
      console.error('No token file found, re-authentication required.');
      return await authenticate(callback);
    }
  } catch (error) {
    console.error('Error validating or refreshing token:', error);
    return callback(error, null);
  }
}

async function authenticate(callback) {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/youtube.force-ssl'],
  });

  console.log('Visit the following URL to authenticate:\n' + authUrl);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.question('Enter the code from the URL here: ', async (code) => {
    try {
      const { tokens } = await oauth2Client.getToken(code);
      oauth2Client.setCredentials(tokens);
      fs.writeFileSync(tokenPath, JSON.stringify(tokens));
      console.log('Successfully authenticated and tokens stored!');
      rl.close();
      return callback(null, tokens);
    } catch (error) {
      console.error('Error during authentication:', error);
      rl.close();
      return callback(error, null);
    }
  });
}

module.exports = {
  validateAuthToken
};
