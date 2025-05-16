const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const readline = require('readline');
const https = require('https');
const http = require('http');
const cliProgress = require('cli-progress');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
ffmpeg.setFfmpegPath(ffmpegPath);
const { v4: uuidv4 } = require('uuid');
const tmp = require('tmp-promise'); // optional helper for temp files
const { validateAuthToken } = require('./token_update'); // Adjust the path if needed

// OAuth2 Client
const oauth2Client = new google.auth.OAuth2(
  '325773506269-a9th9rvbi3pij6vi8mvapdqda3c5s0d9.apps.googleusercontent.com', // client_id
  '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', // client_secret
  'http://localhost' // Redirect URI
);

// Set up the YouTube API
const youtube = google.youtube({
  version: 'v3',
  auth: oauth2Client,
});

// Path to store token
const tokenPath = path.join(process.cwd(), 'token.json');

// User input interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

let videoTitle = 'Spadkiam Full Movie | Thrilling Drama & Suspense';
let description = `Watch the complete Spadkiam movie in two parts!  
Dive into this thrilling drama filled with suspense, twists, and unforgettable characters.  
Part 1 introduces the gripping story, setting the stage for an epic climax in Part 2.  

✅ Don’t forget to like, comment, and subscribe for more full-length movies!  
#Spadkiam #FullMovie #Drama #Suspense #Thriller #MovieNight`;

let tags = ['Spadkiam', 'Spadkiam movie', 'Full movie', 'Drama movie', 'Suspense thriller', 'Part 1', 'Part 2', 'Bollywood movie', 'Indian cinema'];
let thumblinePath = "assets/thumb.jpg";

// Step 1: Ask for YouTube URL and download video

function promptVideoUrl() {
  rl.question('Enter the direct video URL to download: ', (url) => {
    const outputDir = path.join(__dirname, 'video');
    const outputPath = path.join(outputDir, 'video.mp4');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

    console.log('Starting video download...');

    const protocol = url.startsWith('https') ? https : http;
    const progressBar = new cliProgress.SingleBar({
      format: 'Downloading [{bar}] {percentage}% | {downloadedMB}MB / {totalMB}MB',
    }, cliProgress.Presets.shades_classic);

    protocol.get(url, (res) => {
      const totalSize = parseInt(res.headers['content-length'], 10);
      let downloaded = 0;

      const totalMB = (totalSize / (1024 * 1024)).toFixed(2);

      progressBar.start(totalSize, 0, {
        downloadedMB: '0.00',
        totalMB,
      });

      const fileStream = fs.createWriteStream(outputPath);

      res.on('data', (chunk) => {
        downloaded += chunk.length;
        const downloadedMB = (downloaded / (1024 * 1024)).toFixed(2);
        progressBar.update(downloaded, {
          downloadedMB,
        });
      });

      res.pipe(fileStream);

      fileStream.on('finish', () => {
        progressBar.stop();
        fileStream.close();
        console.log('\nDownload completed.');
        authenticate(); // Your function here
      });
    }).on('error', (err) => {
      console.error('Download failed:', err.message);
    });
  });
}
function promptThumbnailUrl() {
  rl.question('Enter the direct thumbnail URL to download: ', (url) => {
    const outputDir = path.join(__dirname, 'assets');
    const thumblinePath = path.join(outputDir, 'thumb.jpg');

    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

    console.log('Starting thumbnail download...');

    const protocol = url.startsWith('https') ? https : http;
    const progressBar = new cliProgress.SingleBar({
      format: 'Downloading [{bar}] {percentage}% | {downloadedMB}MB / {totalMB}MB',
    }, cliProgress.Presets.shades_classic);

    protocol.get(url, (res) => {
      const totalSize = parseInt(res.headers['content-length'], 10);
      let downloaded = 0;

      const totalMB = (totalSize / (1024 * 1024)).toFixed(2);

      progressBar.start(totalSize, 0, {
        downloadedMB: '0.00',
        totalMB,
      });

      const fileStream = fs.createWriteStream(thumblinePath);

      res.on('data', (chunk) => {
        downloaded += chunk.length;
        const downloadedMB = (downloaded / (1024 * 1024)).toFixed(2);
        progressBar.update(downloaded, {
          downloadedMB,
        });
      });

      res.pipe(fileStream);

      fileStream.on('finish', () => {
        progressBar.stop();
        fileStream.close();
        console.log('\nThumbnail download completed.');
        promptVideoUrl();
      });
    }).on('error', (err) => {
      console.error('Download failed:', err.message);
    });
  });
}
// Step 2: Authenticate and Upload
async function authenticate() {
  validateAuthToken((err, credentials) => {
    if (err) {
      console.error('Auth failed:', err);
      return;
    }
    // Now call your logic after successful auth
    oauth2Client.setCredentials(credentials);
    splitAndUpload();
  });
}

// Step 3: Upload Video to YouTube


async function splitAndUpload() {
  const inputPath = path.join(__dirname, 'video/video.mp4');
  const outputDir = path.join(__dirname, 'video/parts');

  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

  console.log('Splitting video into 20-minute parts...');

  const durationCommand = ffmpeg(inputPath);

  durationCommand.ffprobe(0, async (err, data) => {
    if (err) {
      console.error('Error getting video duration:', err);
      return;
    }

    const duration = data.format.duration;
    const partDuration = 1200; // 20 minute
    let partIndex = 1;

    for (let start = 0; start < duration; start += partDuration) {
      const partFileName = `Part-${partIndex} | ${videoTitle}`;
      const partFilePath = path.join(outputDir, `Part-${partIndex}.mp4`);

      try {
        const actualStart = (partIndex > 1) ? Math.max(start - 10, 0) : start;
        await processPart(inputPath, partFilePath, actualStart, partDuration);
        console.log(`Generated: ${partFilePath}`);
        partIndex++;
        uploadVideo(partFilePath, partFileName);
      } catch (error) {
        console.error(`Error processing part ${partIndex}:`, error);
        break;
      }
    }
  });
}

async function processPart(inputPath, outputPath, startTime, duration) {
await new Promise((resolve, reject) => {
  ffmpeg(inputPath)
    .setStartTime(startTime)
    .setDuration(duration)
    .output(outputPath)
    .on('progress', (progress) => {
      console.log(`Processing: ${progress.percent?.toFixed(2) || 0}%`);
    })
    .on('end', () => {
      console.log('Processing finished successfully');
      resolve();
    })
    .on('error', (err) => {
      console.error('Error during processing:', err.message);
      reject(err);
    })
    .run();
});
  // const tempMainTs = outputPath.replace('.mp4', '_main.ts');
  // const tempEndCardTs = outputPath.replace('.mp4', '_endcard.ts');
  // const endCardPath = path.resolve(__dirname, 'video', 'end_card.mp4');

  // // Step 1: Extract main part and convert to TS
  // await new Promise((resolve, reject) => {
  //   ffmpeg(inputPath)
  //     .setStartTime(startTime)
  //     .setDuration(duration)
  //     .outputOptions([
  //       '-c:v libx264',
  //       '-c:a aac',
  //       '-preset veryfast',
  //       '-crf 23',
  //       '-f mpegts'
  //     ])
  //     .output(tempMainTs)
  //     .on('end', resolve)
  //     .on('error', reject)
  //     .run();
  // });

  // // Step 2: Convert end card to TS with same codec/format
  // await new Promise((resolve, reject) => {
  //   ffmpeg(endCardPath)
  //     .outputOptions([
  //       '-c:v libx264',
  //       '-c:a aac',
  //       '-preset veryfast',
  //       '-crf 23',
  //       '-f mpegts'
  //     ])
  //     .output(tempEndCardTs)
  //     .on('end', resolve)
  //     .on('error', reject)
  //     .run();
  // });

  // // Step 3: Concatenate TS files into final MP4
  // await new Promise((resolve, reject) => {
  //   ffmpeg()
  //     .input(`concat:${tempMainTs}|${tempEndCardTs}`)
  //     .outputOptions(['-c copy', '-bsf:a aac_adtstoasc'])
  //     .output(outputPath)
  //     .on('end', resolve)
  //     .on('error', reject)
  //     .run();
  // });

  // // Step 4: Clean temp files
  // fs.unlinkSync(tempMainTs);
  // fs.unlinkSync(tempEndCardTs);

  console.log('Video processing completed successfully.');
}

async function uploadVideo(currentPath, title) {

  const video = fs.createReadStream(currentPath);
  const fileSize = fs.statSync(currentPath).size;

  const resource = {
    snippet: {
      title: title,
      description: description,
      tags: tags,
    },
    status: {
      privacyStatus: 'public',
    },
  };

  try {
    const res = await youtube.videos.insert({
      part: 'snippet,status',
      resource,
      media: {
        body: video,
      },
    }, {
      onUploadProgress: evt => {
        const uploaded = evt.bytesRead || evt.bytesTransferred || 0;
        const percent = ((uploaded / fileSize) * 100).toFixed(2);
        process.stdout.write(`\rUploading: ${percent}%`);
      }
    });

    console.log('\nVideo uploaded successfully!');
    console.log('Video ID:', res.data.id);

    // Upload thumbnail
    const videoId = res.data.id;
    await youtube.thumbnails.set({
      videoId,
      media: {
        body: fs.createReadStream(thumblinePath),
      },
    });
    console.log('Thumbnail uploaded successfully!');

    // Add the video to a playlist
    const playlistId = 'PLJNjpTlwckF1VSpdGe67rr2uKvMSHu29F'; // Replace with your actual playlist ID
    youtube.playlistItems.insert({
      part: 'snippet',
      resource: {
        snippet: {
          playlistId: playlistId,
          resourceId: {
            kind: 'youtube#video',
            videoId: videoId,
          },
        },
      },
    });
    console.log('Video added to playlist successfully!');
  } catch (error) {
    console.error('Error uploading video:', error);
  }
}

// Step 4: Refresh token every 10 minutes
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

// Start the flow
// promptThumbnailUrl();
// promptVideoUrl();
authenticate();
//  splitAndUpload();

