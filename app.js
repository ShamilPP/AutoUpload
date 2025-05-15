require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const { google } = require('googleapis');
const cliProgress = require('cli-progress');
const http = require('http');
const WebSocket = require('ws');

// Load environment variables
const {
    CLIENT_ID,
    CLIENT_SECRET,
    REDIRECT_URI,
    TOKEN_PATH,
    PORT
} = process.env;

// Initialize OAuth2 client
const oauth2Client = new google.auth.OAuth2(
    CLIENT_ID,
    CLIENT_SECRET,
    REDIRECT_URI
);

// Set up the YouTube API
const youtube = google.youtube({
    version: 'v3',
    auth: oauth2Client,
});

// Express setup
const app = express();
app.use(express.json());

// Create HTTP server for WebSocket
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Auto-refresh token every 10 minutes
setInterval(async () => {
    try {
        const tokens = oauth2Client.credentials;
        if (tokens.refresh_token) {
            const { credentials } = await oauth2Client.refreshAccessToken();
            oauth2Client.setCredentials(credentials);
            fs.writeFileSync(TOKEN_PATH, JSON.stringify(credentials));
            console.log('🔄 Token refreshed');
        }
    } catch (error) {
        console.error('❌ Error refreshing token:', error.message);
    }
}, 600000);

// Authenticate the user
app.get('/auth', async (req, res) => {
    try {
        if (fs.existsSync(TOKEN_PATH)) {
            const tokenData = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'));
            oauth2Client.setCredentials(tokenData);
            return res.send('✅ Using stored credentials');
        }

        const authUrl = oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: ['https://www.googleapis.com/auth/youtube.upload'],
        });

        res.send(`🔗 Visit this URL to authenticate: <a href="${authUrl}" target="_blank">Authenticate</a>`);
    } catch (error) {
        console.error('❌ Error authenticating:', error.message);
        res.status(500).send('Authentication failed');
    }
});

// Save the token
app.get('/callback', async (req, res) => {
    try {
        const { code } = req.query;
        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);
        fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
        res.send('✅ Authentication successful, tokens saved');
    } catch (error) {
        console.error('❌ Error saving token:', error.message);
        res.status(500).send('Token saving failed');
    }
});

// WebSocket connection for live updates
wss.on('connection', (ws) => {
    console.log('🟢 WebSocket connection established');
    ws.on('close', () => console.log('🔴 WebSocket connection closed'));
});

// Download video from URL
app.post('/api/download', (req, res) => {
    try {
        const { url } = req.body;
        const outputPath = path.join(__dirname, 'videos', 'video.mp4');
        const protocol = url.startsWith('https') ? require('https') : require('http');
        const file = fs.createWriteStream(outputPath);

        protocol.get(url, (response) => {
            const totalSize = parseInt(response.headers['content-length'], 10);
            let downloaded = 0;

            response.on('data', (chunk) => {
                downloaded += chunk.length;
                const progress = ((downloaded / totalSize) * 100).toFixed(2);
                wss.clients.forEach((client) => {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify({ type: 'download', progress }));
                    }
                });
            });

            response.pipe(file);

            file.on('finish', () => {
                console.log('✅ Download completed');
                res.send('Download completed');
            });
        });
    } catch (error) {
        console.error('❌ Error downloading video:', error.message);
        res.status(500).send('Download failed');
    }
});

// Upload video to YouTube
app.post('/api/upload', async (req, res) => {
    try {
        const { title, description } = req.body;
        const videoFilePath = path.join(__dirname, 'videos', 'video.mp4');
        const videoStream = fs.createReadStream(videoFilePath);
        const fileSize = fs.statSync(videoFilePath).size;

        const response = await youtube.videos.insert({
            part: 'snippet,status',
            requestBody: {
                snippet: { title, description, tags: ['video', 'upload'] },
                status: { privacyStatus: 'private' },
            },
            media: { body: videoStream },
        }, {
            onUploadProgress: (evt) => {
                const percent = ((evt.bytesRead / fileSize) * 100).toFixed(2);
                wss.clients.forEach((client) => {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify({ type: 'upload', progress: percent }));
                    }
                });
            },
        });

        console.log('✅ Video uploaded successfully');
        res.send(`Video uploaded successfully. Video ID: ${response.data.id}`);
    } catch (error) {
        console.error('❌ Error uploading video:', error.message);
        res.status(500).send('Upload failed');
    }
});

// Start the server
server.listen(PORT || 3000, () => console.log(`🚀 Server running on port ${PORT || 3000}`));
