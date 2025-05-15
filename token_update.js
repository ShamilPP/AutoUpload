// setInterval(() => {
//   const credentials = oauth2Client.credentials;
//   if (credentials.refresh_token) {
//     oauth2Client.refreshAccessToken((err, tokens) => {
//       if (err) {
//         console.error('Error refreshing token:', err);
//         return;
//       }
//       oauth2Client.setCredentials(tokens);
//       fs.writeFileSync(tokenPath, JSON.stringify(tokens));
//       console.log('\nAccess token refreshed!');
//     });
//   }
// }, 600000); // 10 minutes

// async function authenticate() {
//   if (fs.existsSync(tokenPath)) {
//     const tokenData = JSON.parse(fs.readFileSync(tokenPath, 'utf-8'));
//     oauth2Client.setCredentials(tokenData);
//     console.log('Using stored credentials...');
//     return splitAndUpload();
//   }

//   const authUrl = oauth2Client.generateAuthUrl({
//     access_type: 'offline',
//     scope: ['https://www.googleapis.com/auth/youtube.upload']
//   });

//   console.log('Visit the following URL to authenticate:\n' + authUrl);

//   rl.question('Enter the code from the URL here: ', async (code) => {
//     rl.close();
//     const { tokens } = await oauth2Client.getToken(code);
//     oauth2Client.setCredentials(tokens);
//     fs.writeFileSync(tokenPath, JSON.stringify(tokens));
//     console.log('Successfully authenticated and tokens stored!');
//     splitAndUpload();
//   });
// }
const fs = require('fs');
const readline = require('readline');
const { google } = require('googleapis');
const path = require('path');

// Path to store token
const tokenPath = path.join(process.cwd(), 'token.json');

// OAuth2 Client
const oauth2Client = new google.auth.OAuth2(
  '325773506269-a9th9rvbi3pij6vi8mvapdqda3c5s0d9.apps.googleusercontent.com', // client_id
  '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', // client_secret
  'http://localhost' // Redirect URI
);

async function validateAuthToken() {
    try {
        // Load the existing token
        if (fs.existsSync(tokenPath)) {
            const tokenData = JSON.parse(fs.readFileSync(tokenPath, 'utf-8'));
            oauth2Client.setCredentials(tokenData);

            // Check if the token has expired
            const expiryDate = tokenData.expiry_date || 0;
            const now = Date.now();

            if (expiryDate > now) {
                console.log('Token is still valid.');
                return oauth2Client;
            }

            // Token has expired, attempt to refresh
            if (tokenData.refresh_token) {
                console.log('Token expired, attempting to refresh...');
                const { credentials } = await oauth2Client.refreshAccessToken();
                oauth2Client.setCredentials(credentials);
                fs.writeFileSync(tokenPath, JSON.stringify(credentials));
                console.log('Token successfully refreshed.');
                return oauth2Client;
            } else {
                console.error('No refresh token available, re-authentication required.');
                return await authenticate();
            }
        } else {
            console.error('No token file found, re-authentication required.');
            return await authenticate();
        }
    } catch (error) {
        console.error('Error validating or refreshing token:', error);
        throw error;
    }
}

// Function to handle first-time authentication
async function authenticate() {
    const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        prompt: 'consent', // <== add this line
        scope: ['https://www.googleapis.com/auth/youtube.upload'],
    });

    console.log('Visit the following URL to authenticate:\n' + authUrl);

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    return new Promise((resolve) => {
        rl.question('Enter the code from the URL here: ', async (code) => {
            try {
                const { tokens } = await oauth2Client.getToken(code);
                oauth2Client.setCredentials(tokens);
                fs.writeFileSync(tokenPath, JSON.stringify(tokens));
                console.log('Successfully authenticated and tokens stored!');
                rl.close();
                resolve(oauth2Client);
            } catch (error) {
                console.error('Error during authentication:', error);
                rl.close();
                throw error;
            }
        });
    });
}

// Example usage
(async () => {
    try {
        const client = await validateAuthToken();
        console.log('Ready to use authenticated client.');
        // Your upload logic here
    } catch (error) {
        console.error('Failed to authenticate:', error);
    }
})();