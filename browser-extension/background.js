chrome.runtime.onMessage.addListener((message, sender, send_response) => {
    if (sender.id !== chrome.runtime.id || message?.type !== 'download-pin') return false;

    chrome.downloads.download({
        url: message.url,
        filename: message.filename,
        conflictAction: 'uniquify',
        saveAs: false
    }).then(download_id => {
        send_response({ download_id });
    }).catch(error => {
        send_response({ error: error.message });
    });

    return true;
});
