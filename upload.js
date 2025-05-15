// Auto YouTube Shorts Bot - "Today in History"
// Fully Free, Automated, Node.js Based

// STEP 1: Install required packages
// Run: npm install node-fetch cheerio gtts fluent-ffmpeg node-cron googleapis fs-extra ytdl-core

const fetch = require('node-fetch');
const cheerio = require('cheerio');
const gTTS = require('gtts');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs-extra');
const path = require('path');
const cron = require('node-cron');

const OUTPUT_DIR = path.join(__dirname, 'output');

// STEP 2: Scrape "On This Day" from Wikipedia
async function getTodayInHistory() {
    const res = await fetch('https://en.wikipedia.org/wiki/Wikipedia:Selected_anniversaries/' + new Date().toLocaleString('en-US', { month: 'long', day: 'numeric' }));
    const html = await res.text();
    const $ = cheerio.load(html);
    const items = $('ul').first().find('li').toArray().slice(0, 3); // top 3 facts
    return items.map(item => $(item).text().replace(/\[.*?\]/g, ''));
}

// STEP 3: Convert text to audio
async function generateVoice(text, filename) {
    return new Promise((resolve, reject) => {
        const gtts = new gTTS(text, 'en');
        gtts.save(filename, err => {
            if (err) reject(err);
            else resolve();
        });
    });
}

// STEP 4: Generate video with text + voice
async function generateVideo(fact, index) {
    const imgPath = path.join(__dirname, 'assets', 'background.jpg'); // Use a static image or rotate from folder
    const audioPath = path.join(OUTPUT_DIR, `audio${index}.mp3`);
    const videoPath = path.join(OUTPUT_DIR, `video${index}.mp4`);
    const textOverlay = `Today in History:\n${fact}`;

    await generateVoice(fact, audioPath);

    return new Promise((resolve, reject) => {
        ffmpeg()
            .input(imgPath)
            .loop(10)
            .input(audioPath)
            .outputOptions([
                '-vf', `drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:text='${textOverlay}':fontcolor=white:fontsize=24:x=(w-text_w)/2:y=h-th-30`,
                '-shortest'
            ])
            .output(videoPath)
            .on('end', resolve)
            .on('error', reject)
            .run();
    });
}

// STEP 5: Upload to YouTube (placeholder - insert your logic/API keys)
async function uploadToYouTube(videoPath, title, description) {
    console.log(`Uploading ${videoPath} with title: ${title}`);
    // YouTube Data API integration needed here
    // Use OAuth2 or service account (not shown here)
}

// STEP 6: Main automation script
async function runBot() {
    await fs.ensureDir(OUTPUT_DIR);
    const facts = await getTodayInHistory();

    for (let i = 0; i < facts.length; i++) {
        const fact = facts[i];
        await generateVideo(fact, i);
        const videoPath = path.join(OUTPUT_DIR, `video${i}.mp4`);
        // await uploadToYouTube(videoPath, `Today in History - Fact #${i + 1}`, fact);
    }
}

// STEP 7: Run every day at 9 AM
cron.schedule('0 9 * * *', runBot);

// Run once immediately
runBot();
