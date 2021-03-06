const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');
const sdds = require('sdds');

// To help catching bugs and improve SDDS
sdds._config.strongerFormatCheck = true;

/**
 * A class that can read and store the image requested from a folder.
 * 
 * It serves PNG images. DDS images are converted on first read
 */
class ImageServer {
    /**
     * Build a new Image Server
     * @param {string} imagesPath The path in which the images are stored
     */
    constructor(imagesPath) {
        this.folder = imagesPath
        this.cache = {};
    }

    /**
     * Return the image with the given name, or null if it does not exist.
     * 
     * dds images are converted into png format
     * @param {string} imageName Name of the image
     */
    getImage(imageName) {
        if (this.cache[imageName.toLowerCase()] !== undefined) {
            return { ok: this.cache[imageName.toLowerCase()] };
        }

        const lastDot = imageName.lastIndexOf('.');
        if (lastDot === -1) return { error: 'File not found (1)' };

        const extension = imageName.substr(lastDot + 1).toLowerCase();
        if (extension === 'png') {
            return this.#getPng(imageName);
        } else if (extension === 'dds') {
            return this.#getDDS(imageName);
        } else {
            return { error: 'File not found (2)' };
        }
    }

    /**
     * Load and store in the cache the PNG image which has the given name
     * @param {string} imageName The name of the image to load
     * @returns Either a `{ ok: imageBuffer }` or `{ error: 'a message' }`
     */
    #getPng(imageName) {
        try {
            const img = fs.readFileSync(path.join(this.folder, imageName));
            this.cache[imageName.toLowerCase()] = img;
            return { ok: img };
        } catch (err) {
            return { error: 'File not found (png)' };
        }
    }

    /**
     * Load and store in the cache the DDS image which has the given name
     * 
     * The image is first converted in PNG format, and any magenta (#FF00FF)
     * occurrence is replaced with the transparent color (alpha channel to 0)
     * @param {string} imageName The name of the image to load
     * @returns Either a `{ ok: pngImageBuffer }` or `{ error: 'a message' }`
     */
    #getDDS(imageName) {
        try {
            const img = fs.readFileSync(path.join(this.folder, imageName));
            const asPng = ImageServer.pngMagentaToTransparent(sdds(img));
            const buffer = PNG.sync.write(asPng);
            this.cache[imageName.toLowerCase()] = buffer;
            return { ok: buffer };
        } catch (err) {
            console.error(err);
            return { error: 'File not found (dds)' };
        }
    }
    
    /**
     * Convert any magenta pixel to transparent in the given PNG image
     * @param {PNG} png The image to modify
     */
    static pngMagentaToTransparent(png) {
        for (let y = 0; y < png.height; y++) {
            for (let x = 0; x < png.width; x++) {
                const idx = (png.width * y + x) << 2;

                const [red, green, blue] = png.data.slice(idx, idx + 3);
                if (red == 255 && green == 0 && blue == 255) {
                    png.data[idx + 3] = 0;
                }
            }
        }

        return png;
    }
}

module.exports = ImageServer;