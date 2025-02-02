### Pinterest Board Downloader Extension

![alt text](./readme-assets/image-7.png)

Features:

- Users can hover over any pin, select it, and add it to a queue of selected pins to be downloaded
- Users can select all currently visible pins
- Mainly, users can download all pins within a pinterest board (assuming that they are on a pinterest board page).
- Image downloads only (no videos)
- A Fast and simple Pinterest Downloader
  <br>

### How to install the Extension (Chrome & Edge only)

1. Download the [latest release](https://github.com/rrokutaro/pinterest-board-downloader/releases) (the .zip file)
2. Extract the .zip file (you can use winrar or 7zip or built-in windows extractor)
3. Go to your browser. For Google Chrome enter `chrome://extensions/` or for MicroSoft Edge enter `edge://extensions` in the url bar.
4. Enable **Developer mode**.
5. Click **Load unpacked**, a pop up will appear, then select the "browser extension" that you just downloaded
6. Go to Pinterest and the extension will now be working. Enjoy!
   <br>

### Task A: Select pins and download

User enables the pinterest board downloader by clicking on the button

![alt text](./readme-assets/image.png)
<br>

The popup will then show up fully

![alt text](./readme-assets/image-1.png)
<br>

While hovering over a pin, the user holds down the `ShiftKey` + `Right Click` which selects the pin, selecting the pin again unselects it.

![alt text](./readme-assets/Animation.webp)
<br>

User clicks the download button for currently selected pins and the download process begins.

![alt text](./readme-assets/image-2.png)

Once the download process is complete, the appropriate feedback message is shown.

![alt text](./readme-assets/image-3.png)
<br>

Finally, user closes the downloader. Upon closing, selected pins are removed, and will no longer be highlighted. Re-opening the ui would mean a new session (old pins are not remembered).

![alt text](./readme-assets/image-4.png)
<br>

---

<br>

### Task B: Download All Board Pins

User enables the Pinterest Board Downloader

![alt text](./readme-assets/image.png)
<br>

Clicks the 2nd download button that will first extract all pins until the number of extracted pins is equal to the specified number of board pins.

![alt text](./readme-assets/image-5.png)

![alt text](./readme-assets/image-2.png)

Finally, user receives a successful download response.

![alt text](./readme-assets/image-6.png)
<br>

Finally, user closes the downloader. Upon closing, selected pins are removed, and will no longer be highlighted. Re-opening the ui would mean a new session (old pins are not remembered).

![alt text](./readme-assets/image-4.png)
<br>
