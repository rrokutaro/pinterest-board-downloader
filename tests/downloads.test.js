const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const repository_root = path.resolve(__dirname, '..');

test('queues every download with an interval between browser requests', async () => {
    const events = [];
    let next_download_id = 0;
    const context = {
        chrome: {
            runtime: {
                sendMessage: async message => {
                    events.push({ type: 'download', message });
                    return { download_id: next_download_id++ };
                }
            }
        },
        console,
        document: { readyState: 'loading' },
        setTimeout: (callback, delay) => {
            events.push({ type: 'delay', delay });
            queueMicrotask(callback);
        },
        window: { addEventListener() {} }
    };
    vm.createContext(context);

    const client_source = fs.readFileSync(
        path.join(repository_root, 'browser-extension', 'client.js'),
        'utf8'
    );
    vm.runInContext(`${client_source}
        mark_visible_pins_only = () => {};
        DOM.full_ui_wrapper.progress_log_elem.self = { className: '', innerHTML: '' };
        globalThis.download_pins_for_test = download_pins;
        globalThis.download_start_interval_for_test = DOWNLOAD_START_INTERVAL_MS;
    `, context);

    const items = Array.from({ length: 300 }, (_, index) => ({
        media_url: `https://i.pinimg.com/originals/pin-${index}.jpg`,
        pin_url: `https://www.pinterest.com/pin/${index}/`
    }));
    const result = await context.download_pins_for_test(items);

    assert.equal(result.failed_downloads, 0);
    assert.equal(result.successful_downloads, 300);
    assert.equal(events.length, 599);
    for (let index = 0; index < events.length; index++) {
        const expected_type = index % 2 === 0 ? 'download' : 'delay';
        assert.equal(events[index].type, expected_type);
        if (expected_type === 'delay') {
            assert.equal(events[index].delay, context.download_start_interval_for_test);
        }
    }
});

test('background worker confirms a download accepted by Chrome', async () => {
    let message_listener;
    let received_options;
    const context = {
        chrome: {
            downloads: {
                download: async options => {
                    received_options = options;
                    return 42;
                }
            },
            runtime: {
                id: 'extension-id',
                onMessage: {
                    addListener(listener) {
                        message_listener = listener;
                    }
                }
            }
        }
    };
    vm.createContext(context);

    const background_source = fs.readFileSync(
        path.join(repository_root, 'browser-extension', 'background.js'),
        'utf8'
    );
    vm.runInContext(background_source, context);

    const response = await new Promise(resolve => {
        const keeps_message_channel_open = message_listener(
            {
                type: 'download-pin',
                url: 'https://i.pinimg.com/originals/example.jpg',
                filename: 'example.jpg'
            },
            { id: 'extension-id' },
            resolve
        );
        assert.equal(keeps_message_channel_open, true);
    });

    assert.equal(response.download_id, 42);
    assert.deepEqual(
        JSON.parse(JSON.stringify(received_options)),
        {
            url: 'https://i.pinimg.com/originals/example.jpg',
            filename: 'example.jpg',
            conflictAction: 'uniquify',
            saveAs: false
        }
    );
});
