const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

const outputName = 'metacall-protocol-package-test.zip';
const outputPath = path.join(process.cwd(), outputName);

// Delete file if it exists (sync)
if (fs.existsSync(outputPath)) {
    fs.unlinkSync(outputPath);
    console.log(`🗑️ Deleted existing ${outputName}`);
}

const output = fs.createWriteStream(outputPath);
const archive = archiver('zip', { zlib: { level: 9 } });

// Log when done
output.on('close', () => {
    console.log(`✅ Zip created: ${outputName}`);
    console.log(`📦 Total size: ${archive.pointer()} bytes`);
});

// Handle errors
archive.on('error', (err) => {
    console.log(err);
    process.exit(1);
});

// Pipe archive data to the file
archive.pipe(output);

// Add current directory contents
archive.directory('.', false);

// Finalize the archive
archive.finalize();
