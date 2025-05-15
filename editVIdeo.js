const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const readline = require('readline');
const https = require('https');
const http = require('http');
const cliProgress = require('cli-progress');
const ffmpeg = require('fluent-ffmpeg');

function editVideo() {
    const inputPath = path.join(__dirname, 'video', 'video.mp4');
    const outputPath = path.join(__dirname, 'video', 'video_edited.mp4');
    const logoPath = path.join(__dirname,'video', 'logo.png'); // your channel logo
    const endCardPath = path.join(__dirname,'video', 'end_card.mp4'); // a "Thanks for watching" video clip

    const tempCutPath = path.join(__dirname, 'video', 'video_cut.mp4');
    const tempLogoPath = path.join(__dirname, 'video', 'video_with_logo.mp4');

    // Step 1: Cut video to 15 minutes
    ffmpeg(inputPath)
        .setStartTime('00:00:00')
        .setDuration(900) // 15 minutes
        .output(tempCutPath)
        .on('end', () => {
            // Step 2: Add logo to bottom right with 20px padding
            ffmpeg(tempCutPath)
                .outputOptions([
                    `-i ${logoPath}`,
                    '-filter_complex',
                    'overlay=W-w-20:H-h-20'
                ])
                .output(tempLogoPath)
                .on('end', () => {
                    // Step 3: Concatenate end card
                    ffmpeg()
                        .input(tempLogoPath)
                        .input(endCardPath)
                        .on('end', () => {
                            fs.renameSync(outputPath, inputPath); // replace original with edited
                            console.log('\nVideo editing complete.');
                            // callback(); // proceed to authentication and upload
                        })
                        .on('error', (err) => console.error('Concat error:', err.message))
                        .mergeToFile(outputPath, path.join(__dirname, 'temp'));
                })
                .on('error', (err) => console.error('Logo overlay error:', err.message))
                .run();
        })
        .on('error', (err) => console.error('Cut error:', err.message))
        .run();
}
editVideo()