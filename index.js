const express = require('express');
const bodyParser = require('body-parser');
const asciify = require('asciify-image');
const fs = require('fs');
const path = require('path');

const { exec } = require('child_process');
const ffmpegPath = require('ffmpeg-static');

// Split Video to series of images in a folder (1 second is `fps` ammount of images created)
function splitVideoToFrames(imagesDirectory, fps, split = true) {
    return new Promise((resolve, reject) => {
        if (!split) return resolve(true);

        if (!fs.existsSync(imagesDirectory)) {
            fs.mkdirSync(imagesDirectory);
        }

        // Construct the ffmpeg command
        const command = `"${ffmpegPath}" -i "${inputVideoPath}" -vf fps=${fps} "${path.join(imagesDirectory, 'frame-%04d.png')}" -hide_banner -y`;

        // Execute the command
        exec(command, (err, stdout, stderr) => {
            if (err) {
                reject(err);
            } else {
                resolve(true);
            }
        });
    });
}

// Load images from directory to frames list as ASCII images
function loadFrames(options, imagesDirectory) {
    return new Promise((resolve, reject) => {
        
        fs.readdir(imagesDirectory, (err, files) => {
            if (err) {
                return reject(err);
            }
            const promises = files.map((file) => {
                const fileDirectory = path.join(imagesDirectory, file);
                return new Promise((resolve, reject) => {
                    asciify(fileDirectory, options, (err, asciified) => {
                        if (err) return reject(err);
                        resolve(asciified);
                    });
                });
            });

            Promise.all(promises)
                .then(asciifiedFrames => resolve(asciifiedFrames))
                .catch(reject);
        });
    });
};

// Set up variables
const app = express();
const PORT = 3000;

const inputVideoPath = 'chip.mp4'; // Change video here
const imagesDirectory  = 'frames';
const fps = 24;

// set split to false if frames are already provided (e.g.: at second run)
const split = true

let frames = [];
const options = {
    fit: 'box',
    width: 200,
    height: 100
};

console.clear()
console.log("Wait for setup...")

splitVideoToFrames(imagesDirectory, fps, split)
.then(() => {
    console.log('Frames acquired!');
    return loadFrames(options, imagesDirectory)
})
.then(asciifiedFrames => {
    console.log('Frames loaded!');
    frames = asciifiedFrames;
    // After loading frames run server
    app.listen(PORT, () => {
        console.clear()
        console.log(`Server is running on http://localhost:${PORT}`);
    });
}).catch(err => {
    console.error('Error in setup:', err);
});

// Simple server set up 
app.use(bodyParser.urlencoded({ extended: true }));
app.get('/', (req, res) => {
    let frame = 0; // current frame index
    if (frames.length === 0) {
        return res.send('<p>No frames available.</p>');
    }

    res.setHeader('Content-Type', 'text/plain'); // Set content type as plain text for ASCII art

    const interval = setInterval(() => {
        if (frames.length > 0) {
            frame = (frame + 1) % frames.length;
            // Clear the console (terminal) before sending the next frame
            res.write('\x1b[2J\x1b[H'); // ANSI escape code to clear screen
            res.write(frames[frame] + '\n');
        }
    }, 1000 / fps); // Adjust frame rate based on the fps value

    req.on('close', () => {
        clearInterval(interval);
        res.end(); // Ensure the response is properly closed
    });
});
