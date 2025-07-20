let selected_pins = new Map();
let observer_running = false;
let observer;
let last_pin_received_time = 0;
let last_pin_received_cut_off_duration_ms = (1_000 * 30); // 30s
let cancel_downloads = false;
let stateful_mode = true; // Global variable to toggle stateful/stateless mode
let MAX_CONCURRENT_DOWNLOADS = 10; // Throttle updates
let downloaded_pins = new Set(); // Track downloaded pins in stateful mode

let DOM_template = {
    downloader_button: { self: null },
    full_ui_wrapper: {
        self: null,
        selected_pins_wrapper: {
            self: null,
            currently_selected_pins_count_elem: { self: null },
            start_download_btn: { self: null }
        },
        board_count_wrapper: {
            self: null,
            current_board_count_elem: { self: null },
            start_download_btn: { self: null }
        },
        select_visible_pins_elem: { self: null },
        progress_log_elem: { self: null },
        close_ui_elem: { self: null }
    },
    overlay_elem: { self: null }
}; let DOM = DOM_template;

let message_template = {
    clear: 'No logs to view right now.',
    selection_success: 'Successfully selected pins',
    select_error: 'No pins selected. Select pins & try again',
    extraction_progress: 'Extracting pin urls',
    board_count_error: 'Board pin count Not Available',
    board_no_pins: 'No board pins found for this board',
    extraction_error: 'Failed to extract all pins...',
    extraction_error_2: 'Pin extraction stopped: No new pins received',
    extraction_success: 'Successfully extracted pins!',
    download_progress: 'Downloading pins',
    download_error: 'ERROR: Failed to download all pins...',
    download_success: 'Successfully downloaded pins!',
    waiting_for_pins: 'Waiting for new pins...'
};

const progress_logs = ['cc_log', 'cc_warning', 'cc_error', 'cc_success'];
function logger(level, message, context = {}) {
    const timestamp = new Date().toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg' });
    const logMessage = `[${timestamp}] [${level}] ${message} ${Object.keys(context).length > 0 ? JSON.stringify(context) : ''}`;
    switch (level) {
        case 'ERROR': console.error(logMessage); break;
        case 'WARN': console.warn(logMessage); break;
        case 'DEBUG': console.debug(logMessage); break;
        default: console.log(logMessage);
    }
}

if (document.readyState === 'complete') initialize();
else window.addEventListener('load', initialize);

async function initialize() {
    console.log(`initialize()`);
    // Load downloaded_pins from localStorage if stateful_mode is enabled
    if (stateful_mode) {
        const stored_pins = localStorage.getItem('downloaded_pins');
        if (stored_pins) {
            downloaded_pins = new Set(JSON.parse(stored_pins));
            console.log(`Loaded ${downloaded_pins.size} downloaded pins from localStorage`);
        }
    }

    let downloader_button = html_to_element(`<div id="cc_enable_downloader">
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&display=swap');
        div#cc_enable_downloader {
            --cc_fg_main: #777777;
            --cc_fg_sec: #CDCDCD;
            --cc_bg_main: #343434;
            --cc_bg_dim: rgba(69, 69, 69, 0.6);
            --cc_accent_1: #80BAFF;
            --cc_accent_2: #3487E9;
            --cc_bg_accent_2: rgba(52, 135, 233, 0.5);

            --cc_success: #6C9A73;
            --cc_warning: #9A8E6C;
            --cc_error: #9A6C6C;

            --cc_fz_9px: 0.46875vw;
            --cc_fz_12px: 0.625vw;
            --cc_fz_16px: 0.83333vw;
            --cc_fz_24px: 1.25vw;
            --cc_fz_40px: 2.08333vw;
        }

        .cc_log { color: var(--cc_fg_main) !Important; }
        .cc_warning { color: var(--cc_warning) !Important; }
        .cc_error { color: var(--cc_error) !Important; }
        .cc_success { color: var(--cc_success) !Important; }
        .cc_visible { visibility: visible !Important; }
        .cc_hidden { visibility: hidden !Important; }

        div#cc_enable_downloader,
        div#cc_enable_downloader * {
            padding: 0px;
            margin: 0;
            box-sizing: border-box;
            user-select: none;
            transition: all 250ms ease-in-out;
        }

        div#cc_enable_downloader {
            display: flex;
            gap: var(--cc_fz_12px);
            justify-content: center;
            align-items: center;

            padding: 0.703vw 0.625vw;

            inline-size: fit-content;
            block-size: 3.385vw;

            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: var(--cc_fz_16px);
            font-weight: 400;

            color: var(--cc_fg_main);
            background-color: var(--cc_bg_main);
            outline: 0.052vw solid var(--cc_fg_main);

            position: fixed;
            left: 1.146vw;
            bottom: 1.146vw;
            cursor: pointer;
            z-index: 999999;
        }

        div#cc_enable_downloader:hover>* {
            filter: brightness(1.15);
        }

        div#cc_enable_downloader:active>* {
            filter: brightness(1.5) saturate(1.1);
        }

        div#cc_enable_downloader #cc_downloader_pinterest_logo {
            inline-size: 1.9vw;
            block-size: 1.9vw;
        }

        div#cc_enable_downloader h2 {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: var(--cc_fz_16px);
            font-weight: 400;
            inline-size: fit-content;
            color: var(--cc_fg_main);
        }
    </style>
    <svg id="cc_downloader_pinterest_logo" width="30" height="31" viewBox="0 0 30 31" fill="none"
        xmlns="http://www.w3.org/2000/svg">
        <g clip-path="url(#clip0_209_463)">
            <rect y="0.5" width="30" height="30" rx="15" fill="white" />
            <path
                d="M9.425 29.4375C9.25834 27.7292 9.36667 26.0917 9.75 24.525L11.25 18.05C10.9749 17.2144 10.8274 16.3421 10.8125 15.4625C10.8125 13.3625 11.825 11.8625 13.425 11.8625C14.525 11.8625 15.3375 12.6375 15.3375 14.1125C15.3375 14.5875 15.2417 15.1208 15.05 15.7125L14.4 17.8625C14.275 18.2792 14.2125 18.6625 14.2125 19.0125C14.2125 20.5125 15.35 21.35 16.8125 21.35C19.425 21.35 21.275 18.65 21.275 15.15C21.275 11.25 18.725 8.75 14.9625 8.75C10.7625 8.75 8.10001 11.4875 8.10001 15.3C8.10001 16.825 8.575 18.25 9.4875 19.225C9.1875 19.7375 8.8625 19.825 8.3875 19.825C6.8875 19.825 5.4625 17.7125 5.4625 14.825C5.4625 9.825 9.46251 5.8625 15.0625 5.8625C20.9375 5.8625 24.6375 9.975 24.6375 15.025C24.6375 20.075 21.0375 23.9625 17.1625 23.9625C16.4251 23.9722 15.6955 23.8101 15.0316 23.489C14.3677 23.1679 13.7877 22.6966 13.3375 22.1125L12.5625 25.2375C12.1744 26.8779 11.488 28.4329 10.5375 29.825C12.7833 30.5304 15.1639 30.6965 17.4859 30.3096C19.8079 29.9228 22.006 28.994 23.9019 27.5986C25.7977 26.2032 27.3379 24.3805 28.3974 22.2784C29.457 20.1763 30.006 17.854 30 15.5C30 11.5218 28.4197 7.70644 25.6066 4.8934C22.7936 2.08035 18.9783 0.5 15 0.5C11.0218 0.5 7.20645 2.08035 4.3934 4.8934C1.58036 7.70644 4.8058e-06 11.5218 4.8058e-06 15.5C-0.0023954 18.4992 0.894324 21.4302 2.57438 23.9146C4.25444 26.3991 6.64068 28.3228 9.425 29.4375Z"
                fill="#FF0000" />
        </g>
        <defs>
            <clipPath id="clip0_209_463">
                <rect y="0.5" width="30" height="30" rx="15" fill="white" />
            </clipPath>
        </defs>
    </svg>
    <h2 id="cc_downloader_text"> Enable Pinterest<br>Board Downloader</h2>
</div>`);
    downloader_button.addEventListener('click', initialize_full_ui);
    document.body.appendChild(downloader_button);
    DOM.downloader_button.self = downloader_button;
    console.log(`Pinterest Board Downloader has been initialized`);
    return;
}

function initialize_full_ui() {
    console.log(`initialize_full_ui()`);
    cancel_downloads = false;
    let full_ui_wrapper_elem = html_to_element(`<div id="cc_full_ui_wrapper">
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&display=swap');
        div#cc_full_ui_wrapper {
            --cc_fg_main: #777777;
            --cc_fg_sec: #CDCDCD;
            --cc_bg_main: #343434;
            --cc_bg_dim: rgba(69, 69, 69, 0.6);
            --cc_accent_1: #80BAFF;
            --cc_accent_2: #3487E9;
            --cc_bg_accent_2: rgba(52, 135, 233, 0.5);

            --cc_success: #6C9A73;
            --cc_warning: #9A8E6C;
            --cc_error: #9A6C6C;

            --cc_fz_9px: 0.46875vw;
            --cc_fz_12px: 0.625vw;
            --cc_fz_16px: 0.83333vw;
            --cc_fz_24px: 1.25vw;
            --cc_fz_40px: 2.08333vw;
        }

        .cc_log { color: var(--cc_fg_main) !Important; }
        .cc_warning { color: var(--cc_warning) !Important; }
        .cc_error { color: var(--cc_error) !Important; }
        .cc_success { color: var(--cc_success) !Important; }
        .cc_visible { visibility: visible !Important; }
        .cc_hidden { visibility: hidden !Important; }

        a[data-stateful] { cursor: pointer; }
        a[data-stateful="true"] { color: var(--cc_success) !Important; }
        a[data-stateful="false"] { color: var(--cc_warning) !Important; }

        div#cc_full_ui_wrapper * {
            padding: 0px;
            margin: 0;
            box-sizing: border-box;
            user-select: none;
            transition: all 250ms ease-in-out;
        }

        div#cc_full_ui_wrapper a:hover,
        div#cc_full_ui_wrapper #cc_select_all_visible_pins_elem:hover {
            filter: brightness(1.15);
        }

        div#cc_full_ui_wrapper a:active,
        div#cc_full_ui_wrapper #cc_select_all_visible_pins_elem:active {
            filter: brightness(1.5);
        }

        div#cc_full_ui_wrapper {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: var(--cc_fz_12px);
            color: var(--cc_fg_main);
            background-color: #343434;
            outline: 0.052vw solid var(--cc_fg_main);

            inline-size: 24.74vw;
            block-size: 19.427vw;

            min-inline-size: 24.74vw;
            min-block-size: 19.427vw;

            position: fixed !important;
            left: 1.146vw !important;
            bottom: 1.146vw !important;
            box-shadow: -0.3125vw  0.7292vw 1.9271vw rgba(0, 0, 0, 0.25);
            z-index: 999999;
        }

        div#cc_full_ui_wrapper #cc_section_1 {
            inline-size: 100%;
            block-size: auto;
            padding: 0.833vw;
        }

        div#cc_full_ui_wrapper header#branding {
            display: flex;
            align-items: center;
            gap: 0.313vw;
        }

        div#cc_full_ui_wrapper #cc_pinterest_icon {
            inline-size: var(--cc_fz_16px);
            block-size: var(--cc_fz_16px);
            min-inline-size: 10px;
            min-block-size: 10px;
        }

        div#cc_full_ui_wrapper #cc_branding_name {
            font-size: var(--cc_fz_16px);
            color: var(--cc_fg_sec);
        }

        div#cc_full_ui_wrapper #cc_manual {
            margin-block-start: 7px;
            inline-size: 20.938vw;
        }

        div#cc_full_ui_wrapper #cc_controls_wrapper {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-block-start: 0.8vw;
        }

        div#cc_full_ui_wrapper #cc_section_1 {
            block-size: 11.719vw;
        }

        div#cc_full_ui_wrapper .cc_single_control_wrapper {
            display: flex;
            flex-direction: column;
            align-items: center;
            font-size: var(--cc_fz_9px);

            inline-size: 6.354vw;
            min-inline-size: 3.958vw;
            text-align: center;
        }

        div#cc_full_ui_wrapper .cc_count_display {
            font-size: var(--cc_fz_40px);
            color: var(--cc_fg_sec);
        }

        div#cc_full_ui_wrapper .cc_download_btn {
            margin-block-start: 6px;
            cursor: pointer;
            color: var(--cc_accent_1) !important;
        }

        div#cc_full_ui_wrapper #cc_select_all_visible_pins_elem {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: var(--cc_fz_24px);
            cursor: pointer;
            text-align: start;
            font-weight: 500;
            color: var(--cc_fg_main);
        }

        div#cc_full_ui_wrapper .cc_v_separator {
            inline-size: 0.0521vw;
            block-size: 2.865vw;
            background-color: var(--cc_fg_main);
        }

        div#cc_full_ui_wrapper #cc_section_2 {
            padding-block-start: var(--cc_fz_12px);
            display: flex;
            justify-content: center;
            inline-size: 100%;
            display: flex;
            block-size: 6.719vw;
            border-block-start: 0.052vw solid var(--cc_fg_main);
        }

        div#cc_full_ui_wrapper #cc_log_wrapper {
            display: flex;
            flex-direction: column;
            justify-content: flex-start;
            gap: 0.208vw;
            inline-size: 21.146vw;
        }

        div#cc_full_ui_wrapper #cc_progress_log_elem {
            font-size: var(--cc_fz_40px);
            color: var(--cc_fg_main);
            line-height: 100%;

            display: -webkit-box;
            -webkit-box-orient: vertical;
            -webkit-line-clamp: 2;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        div#cc_full_ui_wrapper footer#cc_section_3 {
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 0.14vw;
            inline-size: 100%;
            font-size: var(--cc_fz_9px);
            line-height: 100%;
            block-size: 0.99vw;
            border-block-start: 0.052vw solid var(--cc_fg_main);
        }

        div#cc_full_ui_wrapper footer#cc_section_3 a {
            color: var(--cc_fg_main);
            line-height: inherit;
            font-weight: bold;
            text-decoration: none;
        }

        div#cc_full_ui_wrapper #cc_close_btn {
            position: absolute;
            right: 0.677vw;
            top: 0.677vw;
            inline-size: 1.094vw;
            block-size: 1.094vw;
            cursor: pointer;
        }

        div#cc_full_ui_wrapper svg#cc_close_btn:hover path {
            fill: var(--cc_error);
            color: var(--cc_error);
            stroke: var(--cc_error);
        }

        div#cc_full_ui_wrapper svg#cc_close_btn:active {
            filter: brightness(1.5) saturate(2);
        }

        div#cc_full_ui_wrapper #cc_progress_log_elem.cc_countdown {
            animation: pulse 1s ease-in-out infinite;
        }

        @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.7; }
            100% { opacity: 1; }
        }
    </style>
    <svg id="cc_close_btn" width="21" height="21" viewBox="0 0 21 21" fill="none"
        xmlns="http://www.w3.org/2000/svg">
        <path d="M7.5 7.5L13.5 13.5M13.5 7.5L7.5 13.5" stroke="#777777" stroke-linecap="round"
            stroke-linejoin="round" />
    </svg>
    <section id="cc_section_1">
        <header id="branding">
            <svg id="cc_pinterest_icon" width="12" height="13" viewBox="0 0 12 13" fill="none"
                xmlns="http://www.w3.org/2000/svg">
                <g clip-path="url(#clip0_214_217)">
                    <rect y="0.5" width="12" height="12" rx="6" fill="white" />
                    <path
                        d="M3.77 12.075C3.70334 11.3917 3.74667 10.7367 3.9 10.11L4.5 7.52C4.38997 7.18576 4.33097 6.83684 4.325 6.485C4.325 5.645 4.73 5.045 5.37 5.045C5.81 5.045 6.135 5.355 6.135 5.945C6.135 6.135 6.09667 6.34833 6.02 6.585L5.76 7.445C5.71 7.61167 5.685 7.765 5.685 7.905C5.685 8.505 6.14 8.84 6.725 8.84C7.77 8.84 8.51 7.76 8.51 6.36C8.51 4.8 7.49 3.8 5.985 3.8C4.305 3.8 3.24 4.895 3.24 6.42C3.24 7.03 3.43 7.6 3.795 7.99C3.675 8.195 3.545 8.23 3.355 8.23C2.755 8.23 2.185 7.385 2.185 6.23C2.185 4.23 3.785 2.645 6.025 2.645C8.375 2.645 9.855 4.29 9.855 6.31C9.855 8.33 8.415 9.885 6.865 9.885C6.57003 9.88889 6.27821 9.82405 6.01265 9.69561C5.74709 9.56717 5.51508 9.37865 5.335 9.145L5.025 10.395C4.86976 11.0511 4.5952 11.6732 4.215 12.23C5.11334 12.5122 6.06554 12.5786 6.99435 12.4239C7.92316 12.2691 8.8024 11.8976 9.56075 11.3394C10.3191 10.7813 10.9352 10.0522 11.359 9.21135C11.7828 8.37051 12.0024 7.44161 12 6.5C12 4.9087 11.3679 3.38258 10.2426 2.25736C9.11742 1.13214 7.5913 0.5 6 0.5C4.4087 0.5 2.88258 1.13214 1.75736 2.25736C0.632143 3.38258 1.92232e-06 4.9087 1.92232e-06 6.5C-0.00095816 7.69967 0.35773 8.87208 1.02975 9.86585C1.70177 10.8596 2.65627 11.6291 3.77 12.075Z"
                        fill="#FF0000" />
                </g>
                <defs>
                    <clipPath id="clip0_214_217">
                        <rect y="0.5" width="12" height="12" rx="6" fill="white" />
                    </clipPath>
                </defs>
            </svg>
            <h1 id="cc_branding_name">Pinterest Board Downloader</h3>
        </header>
        <p id="cc_manual">
            Note: To manually select or deselect pins, <b>Right Click</b> while holding the <b>ShiftKey</b>. Please
            keep in mind that while the downloader is running, not to close the current tab or open any pins as this
            may cause the operation to fail. I hope you find this tool helpful. Enjoy!
        </p>
        <div id="cc_controls_wrapper">
            <div id="cc_selected_pins_wrapper" class="cc_single_control_wrapper">
                <h1 id="cc_currently_selected_pins_count_elem" class="cc_count_display">0</h1>
                <p>
                    Number of currently selected pins
                </p>
                <p id="cc_download_selected_pins_elem" class="cc_download_btn">Download</p>
            </div>
            <div class="cc_v_separator"></div>
            <div id="cc_board_count_wrapper" class="cc_single_control_wrapper">
                <h1 id="cc_current_board_count_elem" class="cc_count_display">1.87k</h1>
                <p>
                    Total number of pins available for this board
                </p>
                <p id="cc_download_all_pins_elem" class="cc_download_btn">Download</p>
            </div>
            <div class="cc_v_separator"></div>
            <div id="cc_select_all_visible_pins_wrapper" class="cc_single_control_wrapper">
                <h1 id="cc_select_all_visible_pins_elem">Select All
                    Visible Pins</h1>
            </div>
        </div>
    </section>
    <section id="cc_section_2">
        <div id="cc_log_wrapper">
            <p>Progress Log:</p>
            <h1 id="cc_progress_log_elem">No logs to view right now.</h1>
        </div>
    </section>
    <footer id="cc_section_3">
        <a data-stateful="true" role="button">Skip Downloaded Pins (Enabled)</a>
    </footer>
</div>`);

    DOM.full_ui_wrapper.self = full_ui_wrapper_elem;
    DOM.full_ui_wrapper.close_ui_elem.self = full_ui_wrapper_elem.querySelector('#cc_close_btn');

    DOM.full_ui_wrapper.selected_pins_wrapper.self = full_ui_wrapper_elem.querySelector('#cc_selected_pins_wrapper');
    DOM.full_ui_wrapper.selected_pins_wrapper.currently_selected_pins_count_elem.self = full_ui_wrapper_elem.querySelector('#cc_currently_selected_pins_count_elem');
    DOM.full_ui_wrapper.selected_pins_wrapper.start_download_btn.self = full_ui_wrapper_elem.querySelector('#cc_download_selected_pins_elem');

    DOM.full_ui_wrapper.board_count_wrapper.self = full_ui_wrapper_elem.querySelector('#cc_board_count_wrapper');
    DOM.full_ui_wrapper.board_count_wrapper.current_board_count_elem.self = full_ui_wrapper_elem.querySelector('#cc_current_board_count_elem');
    DOM.full_ui_wrapper.board_count_wrapper.start_download_btn.self = full_ui_wrapper_elem.querySelector('#cc_download_all_pins_elem');
    DOM.full_ui_wrapper.select_visible_pins_elem.self = full_ui_wrapper_elem.querySelector('#cc_select_all_visible_pins_elem');
    DOM.full_ui_wrapper.progress_log_elem.self = full_ui_wrapper_elem.querySelector('#cc_progress_log_elem');

    let pin_count = get_board_pin_count();
    if (pin_count?.pin_count >= 0) {
        let update_response = update_element_html(DOM.full_ui_wrapper.board_count_wrapper.current_board_count_elem.self, pin_count.formatted_pin_count);
        if (update_response === false) console.log(`Element for displaying board count not found or we failed to set the board count. No need to worry, the board pin count is: ${pin_count.pin_count}. Downloading of all pins within the board will still be possible`);
        else console.log(`Element for displaying board count has been updated with the latest board pin count`);
    } else {
        DOM.full_ui_wrapper.board_count_wrapper.current_board_count_elem.self.innerHTML = 'N/A';
        console.log(`Board pin count not found! Selecting the download all pins will not run`);
    }

    DOM.full_ui_wrapper.select_visible_pins_elem.self.addEventListener('click', select_all_visible_pins);
    DOM.full_ui_wrapper.selected_pins_wrapper.start_download_btn.self.addEventListener('click', initialize_downloads);
    DOM.full_ui_wrapper.board_count_wrapper.start_download_btn.self.addEventListener('click', () => extract_board_pins(pin_count?.pin_count));
    DOM.full_ui_wrapper.close_ui_elem.self.addEventListener('click', close_full_ui);
    document.addEventListener('contextmenu', handle_click);
    document.addEventListener('scroll', remark_selected_pins);
    document.addEventListener('drop', remark_selected_pins);
    window.addEventListener('resize', remark_selected_pins);

    document.body.style.userSelect = 'none';
    DOM.downloader_button.self.classList.remove('cc_visible');
    DOM.downloader_button.self.classList.add('cc_hidden');
    document.body.appendChild(full_ui_wrapper_elem);

    let state_control_btn = document.querySelector('a[data-stateful]');
    state_control_btn.addEventListener("click", (ev) => {
        let state = state_control_btn.dataset.stateful;
        if (state == "true") {
            stateful_mode = false;
            state_control_btn.dataset.stateful = "false";
            state_control_btn.innerHTML = "Skip Downloaded Pins (Disabled)";
            state_control_btn.setAttribute('data-stateful', "false");
            downloaded_pins.clear();
            localStorage.removeItem('downloaded_pins');
            console.log(`Stateful mode disabled, cleared downloaded_pins`);
        } else {
            stateful_mode = true;
            state_control_btn.dataset.stateful = "true";
            state_control_btn.innerHTML = "Skip Downloaded Pins (Enabled)";
            state_control_btn.setAttribute('data-stateful', "true");
            const stored_pins = localStorage.getItem('downloaded_pins');
            if (stored_pins) {
                downloaded_pins = new Set(JSON.parse(stored_pins));
                console.log(`Stateful mode enabled, loaded ${downloaded_pins.size} pins from localStorage`);
            }
            console.log(`Stateful mode enabled`);
        }
    });

    return;
}

async function remark_selected_pins() {
    console.log(`remark_selected_pins()`);
    let pin_urls = Array.from(selected_pins?.keys() || []);
    select_pins(pin_urls, true, true);
    return true;
}

async function handle_click(event) {
    console.log(`handle_click()`, { event });
    if (event.shiftKey) {
        event.preventDefault();
        let coordinates = { clientX: event.clientX, clientY: event.clientY };
        console.log({ coordinates });

        let element_below = document.elementFromPoint(coordinates.clientX, coordinates.clientY);
        if (element_below) {
            let match = element_below?.closest('[data-grid-item]:has(a[href*="/pin/"])');
            if (match) {
                let pin_url = match.querySelector('a[href*="/pin/"]')?.href || '';
                if ((typeof pin_url === 'string') && (pin_url?.length > 0)) {
                    pin_url = clean_pin_urls([pin_url])?.at(0);

                    if (pin_url) {
                        if (selected_pins.has(pin_url)) {
                            console.log(`Pin already selected, will unselect`, { pin_url });
                            unselect_pins([pin_url]);
                        } else {
                            console.log(`New pin, will select`, { pin_url });
                            select_pins([pin_url]);
                        }
                    }
                }
            }
        }
        return true;
    }
}

async function extract_board_pins(pin_count) {
    logger('INFO', `Starting pin extraction`, { pin_count });
    if (!Number.isInteger(pin_count) || pin_count <= 0) {
        logger('ERROR', `Invalid or zero pin count`, { pin_count });
        DOM.full_ui_wrapper.board_count_wrapper.current_board_count_elem.self.innerHTML = 'N/A';
        DOM.full_ui_wrapper.progress_log_elem.self.classList.remove(...progress_logs);
        DOM.full_ui_wrapper.progress_log_elem.self.classList.add('cc_error');
        DOM.full_ui_wrapper.progress_log_elem.self.innerHTML = message_template.board_count_error;
        return false;
    }

    if (!stateful_mode) {
        selected_pins.clear();
        downloaded_pins.clear();
        localStorage.removeItem('downloaded_pins');
        logger('INFO', `Cleared selected and downloaded pins (stateless mode)`);
    }

    observer = new MutationObserver(async (mutation_records) => {
        let pin_urls = new Set();
        let current_time = Date.now();

        const container = document.querySelector('[data-test-id="board-feed"]') || document.body;
        logger('DEBUG', `Observing container`, { container: container.tagName });

        for (let record of mutation_records) {
            if (record.type !== 'childList') continue;

            let added_nodes = Array.from(record?.addedNodes || []);
            for (let node of added_nodes) {
                if (node.nodeType !== Node.ELEMENT_NODE) continue;

                let matches = node.querySelectorAll('[data-grid-item] a[href*="/pin/"], [data-test-id="pin"] a[href*="/pin/"]') || [];
                matches = Array.from(matches).map(link => link?.href).filter(url => url && typeof url === 'string');
                logger('DEBUG', `Found potential pin links`, { count: matches.length, urls: matches.slice(0, 3) });

                if (matches.length > 0) {
                    pin_urls.add(...clean_pin_urls(matches));
                    last_pin_received_time = current_time;
                }
            }
        }

        if (pin_urls.size > 0) {
            select_pins([...pin_urls]);
            let extraction_percentage = ((selected_pins.size / pin_count) * 100).toFixed(2);
            logger('INFO', `Extracted new pins`, { count: pin_urls.size, total_selected: selected_pins.size, percentage: extraction_percentage });
            DOM.full_ui_wrapper.progress_log_elem.self.classList.remove(...progress_logs);
            DOM.full_ui_wrapper.progress_log_elem.self.classList.add('cc_log');
            DOM.full_ui_wrapper.progress_log_elem.self.innerHTML = `${message_template.extraction_progress}: ${extraction_percentage}% (${selected_pins.size}/${pin_count} pins)`;
        }

        if (selected_pins.size >= pin_count) {
            logger('INFO', `All pins extracted`, { total_selected: selected_pins.size });
            observer?.disconnect();
            observer = null;
            observer_running = false;
            DOM.full_ui_wrapper.progress_log_elem.self.classList.remove(...progress_logs);
            DOM.full_ui_wrapper.progress_log_elem.self.classList.add('cc_success');
            DOM.full_ui_wrapper.progress_log_elem.self.innerHTML = message_template.extraction_success;
            await initialize_downloads();
            if (!stateful_mode) unselect_pins(Array.from(selected_pins.keys()));
            return;
        }
    });

    let target_elem = document.querySelector('[data-test-id="board-feed"]') || document.body;
    let observer_options = { childList: true, subtree: true };
    select_all_visible_pins();
    observer_running = true;
    last_pin_received_time = Date.now();
    observer.observe(target_elem, observer_options);
    logger('INFO', `Started observing DOM for pin extraction`, { target: target_elem.tagName });

    await new Promise((res, rej) => {
        window.scrollTo({ top: 0 });
        setTimeout(res, 500); // Allows window.scrollTo to make its way onto to the main thread
    });

    await scroll_down(1000);
    return true;
}

async function scroll_down(delay = 1000, human_behavior = true, px = window.innerHeight * 0.75) {
    logger('INFO', `Scrolling down to load more pins`, { delay, human_behavior, px, scrollY: window.scrollY, documentHeight: document.documentElement.scrollHeight });

    if (!observer_running || cancel_downloads) {
        logger('WARN', `Scroll down operation cancelled`, { observer_running, cancel_downloads });
        return true;
    }

    let time_passed = Date.now() - last_pin_received_time;
    let time_remaining = Math.max(0, last_pin_received_cut_off_duration_ms - time_passed);

    if (time_passed % 5000 < delay) {
        let seconds_remaining = Math.ceil(time_remaining / 1000);
        logger('INFO', `Waiting for new pins`, { seconds_remaining, total_selected: selected_pins.size });
        DOM.full_ui_wrapper.progress_log_elem.self.classList.remove(...progress_logs);
        DOM.full_ui_wrapper.progress_log_elem.self.classList.add('cc_log', 'cc_countdown');
        DOM.full_ui_wrapper.progress_log_elem.self.innerHTML = `${message_template.waiting_for_pins}: ${seconds_remaining}s remaining (${selected_pins.size} pins found)`;
    }

    if (time_passed > last_pin_received_cut_off_duration_ms) {
        logger('WARN', `No new pins received for ${Math.round(time_passed / 1000)}s, stopping extraction`, { total_selected: selected_pins.size });
        observer?.disconnect();
        observer = null;
        observer_running = false;
        DOM.full_ui_wrapper.progress_log_elem.self.classList.remove(...progress_logs);
        DOM.full_ui_wrapper.progress_log_elem.self.classList.add('cc_warning');
        DOM.full_ui_wrapper.progress_log_elem.self.innerHTML = `Pin extraction stopped: No new pins received for ${Math.round(time_passed / 1000)}s (${selected_pins.size} pins found)`;
        await initialize_downloads();
        return true;
    }

    const scrollY = window.scrollY || window.pageYOffset;
    const windowHeight = window.innerHeight;
    const documentHeight = document.documentElement.scrollHeight;
    let bottom_retries = sessionStorage.getItem('bottom_retries') ? parseInt(sessionStorage.getItem('bottom_retries')) : 0;

    if (scrollY + windowHeight >= documentHeight - 100 && bottom_retries < 3) {
        logger('INFO', `Near page bottom, retrying`, { retry: bottom_retries + 1, scrollY, documentHeight });
        sessionStorage.setItem('bottom_retries', bottom_retries + 1);
        await new Promise(resolve => setTimeout(resolve, 2000));
        return scroll_down(delay, human_behavior, px);
    } else if (scrollY + windowHeight >= documentHeight - 100) {
        logger('INFO', `Reached page bottom after retries`, { total_selected: selected_pins.size });
        sessionStorage.removeItem('bottom_retries');
        observer?.disconnect();
        observer = null;
        observer_running = false;
        DOM.full_ui_wrapper.progress_log_elem.self.classList.remove(...progress_logs);
        DOM.full_ui_wrapper.progress_log_elem.self.classList.add('cc_warning');
        DOM.full_ui_wrapper.progress_log_elem.self.innerHTML = `Reached end of page, proceeding to download (${selected_pins.size} pins found)`;
        await initialize_downloads();
        return true;
    }

    let altered_px = human_behavior ? px + (Math.random() * px * 0.2) : px;
    let altered_delay = human_behavior ? delay + (Math.random() * delay * 0.2) : delay;
    window.scrollTo({
        top: scrollY + altered_px,
        behavior: 'smooth'
    });

    window.dispatchEvent(new Event('scroll'));

    if (selected_pins.size > 100) {
        let old_pins = Array.from(selected_pins.keys()).slice(0, 50);
        for (let pin of old_pins) {
            let match = document.querySelector(`a[href*="${pin}"]`);
            if (match && !match.closest('[data-grid-item]')) continue;
            match?.remove();
        }
        logger('DEBUG', `Cleaned up old pins`, { count: old_pins.length });
    }

    await new Promise(resolve => setTimeout(resolve, altered_delay));
    return scroll_down(delay, human_behavior, px);
}

async function initialize_downloads() {
    console.log(`initialize_downloads()`);
    if (selected_pins.size === 0) {
        console.log(message_template.select_error);
        DOM.full_ui_wrapper.progress_log_elem.self.classList.remove(...progress_logs);
        DOM.full_ui_wrapper.progress_log_elem.self.classList.add('cc_log');
        DOM.full_ui_wrapper.progress_log_elem.self.innerHTML = message_template.select_error;
        return true;
    }

    let pins = Array.from(selected_pins.values());
    let download_urls = pins
        .map(pin => [pin.image_url, pin.video_url].filter(url => url && typeof url === 'string'))
        .flat()
        .filter(url => {
            const cleaned_url = clean_pin_urls([url])[0] || url;
            const should_download = !stateful_mode || !downloaded_pins.has(cleaned_url);
            console.log(`Checking URL: ${cleaned_url}, Should download: ${should_download}`);
            return should_download;
        });

    console.log({ download_urls, total: download_urls.length });

    try {
        let download_response = await download_pins(download_urls);
        console.log(message_template.download_success, download_response);
        DOM.full_ui_wrapper.progress_log_elem.self.classList.remove(...progress_logs);
        DOM.full_ui_wrapper.progress_log_elem.self.classList.add('cc_success');
        DOM.full_ui_wrapper.progress_log_elem.self.innerHTML = message_template.download_success;
        if (stateful_mode) {
            localStorage.setItem('downloaded_pins', JSON.stringify([...downloaded_pins]));
            console.log(`Saved ${downloaded_pins.size} pins to localStorage`);
        }
        return true;
    } catch (err) {
        console.log(message_template.download_error, { original_error: err });
        DOM.full_ui_wrapper.progress_log_elem.self.classList.remove(...progress_logs);
        DOM.full_ui_wrapper.progress_log_elem.self.classList.add('cc_error');
        DOM.full_ui_wrapper.progress_log_elem.self.innerHTML = message_template.download_error;
        return false;
    }
}

function inject_selected_overlay(parentElement, random = false) {
    console.log(`inject_selected_overlay()`);
    const newDiv = document.createElement('div');
    newDiv.setAttribute('data-selected-overlay', 'selected_overlay');
    newDiv.style.position = 'absolute';
    newDiv.style.top = '0';
    newDiv.style.left = '0';
    newDiv.style.width = '100%';
    newDiv.style.height = '100%';
    newDiv.style.zIndex = '999999';
    newDiv.style.backgroundColor = 'rgba(52, 135, 233, 0.5)';
    newDiv.style.border = '0px solid #3487E9';
    newDiv.style.boxShadow = 'inset 0 0 0 0.3646vw #3487E9';
    newDiv.style.borderRadius = '0.833vw';
    newDiv.style.pointerEvents = 'none';
    newDiv.style.opacity = '0'; // Start with opacity 0 for animation
    newDiv.style.transition = `opacity ${random ? (200 + Math.random() * 100) : 50}ms ease-in-out`; // Smooth transition for opacity
    parentElement.appendChild(newDiv);
    // Trigger animation after a short delay to ensure DOM insertion
    setTimeout(() => {
        newDiv.style.opacity = '1';
    }, 10);
    return true;
}

function select_all_visible_pins() {
    console.log(`select_all_visible_pins()`);
    let pin_urls = Array.from(document.querySelectorAll('[data-grid-item] a[href*="/pin/"]') || [])
        .map(link => link?.href)
        .filter(url => url && typeof url === 'string');

    if (pin_urls.length > 0) {
        select_pins(pin_urls);
        console.log(`Selected ${pin_urls.length} visible pins`);
    } else {
        console.log(`No visible pins found to select`);
    }
    return true;
}

async function fetch_highest_quality_image(pin_url) {
    console.log(`fetch_highest_quality_image(${pin_url})`);
    try {
        const response = await fetch(pin_url, { mode: 'cors' });
        if (!response.ok) throw new Error(`Failed to fetch pin page: ${pin_url}`);
        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        const jsonLdScript = doc.querySelector('script[type="application/ld+json"]');
        if (jsonLdScript) {
            const jsonLd = JSON.parse(jsonLdScript.textContent);
            const imageUrl = jsonLd.image || jsonLd.url || '';
            if (imageUrl.includes('/originals/')) {
                console.log(`Found high-quality image in JSON-LD: ${imageUrl}`);
                return imageUrl;
            }
        }

        const ogImage = doc.querySelector('meta[property="og:image"]')?.content;
        if (ogImage && ogImage.includes('/originals/')) {
            console.log(`Found high-quality image in og:image: ${ogImage}`);
            return ogImage;
        }

        const mainImage = doc.querySelector('[data-test-id="pin-image"] img')?.src;
        if (mainImage && mainImage.includes('/originals/')) {
            console.log(`Found high-quality image in pin-image: ${mainImage}`);
            return mainImage;
        }

        console.log(`No high-quality image found for ${pin_url}`);
        return mainImage || ogImage || '';
    } catch (error) {
        console.error(`Error fetching high-quality image for ${pin_url}:`, error);
        return '';
    }
}

async function select_pins(pin_urls, reselect = false, subtle = true) {
    console.log(`select_pins()`, { pin_urls });
    let selected_count = 0;
    pin_urls = clean_pin_urls(pin_urls);

    for (let url of new Set(pin_urls)) {
        let match = document.querySelector(`[data-grid-item]:has(a[href*="${url}"])`);
        if (!match) {
            console.log(`No visual pin element for URL: ${url}`);
            continue;
        }

        if (reselect) {
            let inject_overlay = match.querySelector('[data-selected-overlay]');
            if (!inject_overlay) inject_selected_overlay(match, subtle);
            selected_count++;
            continue;
        }

        let img = match.querySelector(`a[href*="${url}"] img`);
        let img_srcset = img?.srcset || img?.src || '';
        let video_url = match.querySelector('video')?.src || '';

        let image_url = img_srcset ? parse_srcset(img_srcset, true) : '';

        if (!image_url || (!image_url.includes('/originals/') && !image_url.match(/\/\d+x\//))) {
            console.log(`No high-quality image found for pin: ${url}, attempting to fetch from pin page`);
            image_url = await fetch_highest_quality_image(url);
        }

        if (!image_url && !video_url) {
            console.error(`No media found for pin: ${url}`);
            continue;
        }

        if (selected_pins.has(url)) {
            console.log(`Pin already selected: ${url}`);
            continue;
        }

        selected_pins.set(url, {
            url,
            image_url,
            video_url,
            timestamp: Date.now()
        });

        let inject_overlay = match.querySelector('[data-selected-overlay]');
        if (!inject_overlay) inject_selected_overlay(match, subtle);
        selected_count++;
    }

    update_currently_selected_pins();
    DOM.full_ui_wrapper.progress_log_elem.self.classList.remove(...progress_logs);
    DOM.full_ui_wrapper.progress_log_elem.self.classList.add('cc_log');
    DOM.full_ui_wrapper.progress_log_elem.self.innerHTML = selected_count > 0 ? message_template.selection_success : message_template.clear;
    return true;
}

function update_currently_selected_pins() {
    console.log(`update_currently_selected_pins()`);
    DOM.full_ui_wrapper.selected_pins_wrapper.currently_selected_pins_count_elem.self.innerHTML = `${selected_pins?.size || 0}`;
    return true;
}

function unselect_pins(pin_urls, random = true) {
    console.log('unselect_pins()');
    let removal_count = 0;
    pin_urls = clean_pin_urls(pin_urls);

    for (let url of new Set(pin_urls)) {
        selected_pins.delete(url);
        let matches = document.querySelectorAll(`[data-grid-item]:has(a[href*="${url}"])`);
        for (let match of matches) {
            let inject_overlay = match.querySelector('[data-selected-overlay]');
            if (inject_overlay) {
                let _dd = random ? (300 + Math.random() * 100) : 50;
                inject_overlay.style.transition = `opacity ${_dd}ms ease-in-out`;
                inject_overlay.style.opacity = '0';
                setTimeout(() => {
                    inject_overlay.remove();
                }, _dd); // Match the transition duration
                removal_count++;
            }
        }
    }

    if (removal_count > 0) {
        console.log(`Successfully unselected ${removal_count} pins`);
        update_currently_selected_pins();
    } else {
        console.log(`No pins were unselected`);
    }

    DOM.full_ui_wrapper.progress_log_elem.self.classList.remove(...progress_logs);
    DOM.full_ui_wrapper.progress_log_elem.self.classList.add('cc_log');
    DOM.full_ui_wrapper.progress_log_elem.self.innerHTML = message_template.clear;
    return true;
}

function clean_pin_urls(urls) {
    console.log(`clean_pin_urls()`);
    return urls
        .filter(url => typeof url === 'string' && url.length > 0)
        .map(url => url.replace(/^(\\+|\/+)|(\\+|\/+)$/g, '').match(/pin\/+.+$/)?.[0])
        .filter(url => url);
}

function parse_srcset(srcset, best_quality = true) {
    console.log(`parse_srcset()`);
    if (typeof srcset !== 'string' || !srcset) {
        console.log('Invalid or empty srcset. Expected a non-empty string');
        return null;
    }

    let urls = srcset
        .split(',')
        .map(url => url.trim())
        .map(url => url.replace(/\s+\d+x$/, ''))
        .filter(url => url && url.includes('pinimg.com'));

    if (urls.length === 0) {
        console.log('No valid URLs found in srcset');
        return null;
    }

    if (best_quality) {
        urls.sort((a, b) => {
            if (a.includes('/originals/') && !b.includes('/originals/')) return -1;
            if (!a.includes('/originals/') && b.includes('/originals/')) return 1;

            const aRes = a.match(/\/(\d+)x\//)?.[1] || 0;
            const bRes = b.match(/\/(\d+)x\//)?.[1] || 0;
            return parseInt(bRes) - parseInt(aRes);
        });
    }

    return urls[0] || null;
}

async function download_pins(urls) {
    console.log(`download_pins(${urls.length} URLs)`);
    let failed_downloads = 0;
    let successful_downloads = 0;
    const max_concurrent = MAX_CONCURRENT_DOWNLOADS;

    const chunks = [];
    for (let i = 0; i < urls.length; i += max_concurrent) {
        chunks.push(urls.slice(i, i + max_concurrent));
    }

    for (let i = 0; i < chunks.length; i++) {
        if (cancel_downloads) break;

        const chunk = chunks[i];
        const promises = chunk.map(async (url, index) => {
            try {
                const response = await fetch(url, { mode: 'cors' });
                if (!response.ok) throw new Error(`Failed to fetch: ${url}`);
                const blob = await response.blob();
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                const fileName = url.split('/').pop() || `pin_${Date.now()}_${index}`;
                link.download = fileName;
                document.body.appendChild(link);
                link.click();
                await new Promise(resolve => setTimeout(resolve, 200));
                document.body.removeChild(link);
                URL.revokeObjectURL(link.href);
                console.log(`Downloaded: ${fileName} ${url.includes('/originals/') ? '(high quality)' : '(possibly low quality)'}`);
                if (stateful_mode) {
                    const cleaned_url = clean_pin_urls([url])[0] || url;
                    downloaded_pins.add(cleaned_url);
                    console.log(`Added to downloaded_pins: ${cleaned_url}`);
                }
                return true;
            } catch (error) {
                console.error(`Error downloading ${url}:`, error);
                return false;
            }
        });

        const results = await Promise.all(promises);
        successful_downloads += results.filter(r => r).length;
        failed_downloads += results.filter(r => !r).length;

        DOM.full_ui_wrapper.progress_log_elem.self.classList.remove(...progress_logs);
        DOM.full_ui_wrapper.progress_log_elem.self.classList.add('cc_log');
        DOM.full_ui_wrapper.progress_log_elem.self.innerHTML = `${message_template.download_progress}, ${(((i + 1) * max_concurrent / urls.length) * 100).toFixed(2)}%`;
    }

    if (stateful_mode) {
        localStorage.setItem('downloaded_pins', JSON.stringify([...downloaded_pins]));
        console.log(`Saved ${downloaded_pins.size} pins to localStorage`);
    }

    if (failed_downloads >= successful_downloads && successful_downloads > 0) {
        throw new Error(`Too many failed downloads: ${failed_downloads}/${urls.length}`);
    }
    return { failed_downloads, successful_downloads };
}

function get_board_pin_count() {
    console.log(`get_board_pin_count()`);
    let pin_count_element = document.querySelector('[data-test-id="pin-count"]');
    let pin_count = parseInt(
        document.body.innerText?.match(/\d+\s*pin[s]*/i)?.[0]?.match(/\d+/)?.[0] ||
        pin_count_element?.innerText?.match(/\d+\s*pin[s]*/i)?.[0]?.match(/\d+/)?.[0]
    );

    if (!Number.isInteger(pin_count)) {
        console.log(`Failed to extract board pin count`);
        return null;
    }

    let formatted_pin_count;
    if (pin_count >= 1_000_000_000) formatted_pin_count = `${(pin_count / 1_000_000_000).toFixed(2)}B`;
    else if (pin_count >= 1_000_000) formatted_pin_count = `${(pin_count / 1_000_000).toFixed(2)}M`;
    else if (pin_count >= 1_000) formatted_pin_count = `${(pin_count / 1_000).toFixed(2)}k`;
    else formatted_pin_count = `${pin_count}`;

    console.log('Successfully extracted board pin count', { pin_count, formatted_pin_count });
    return { pin_count, formatted_pin_count };
}

function html_to_element(htmlString) {
    console.log(`html_to_element()`);
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');
    return doc.body.firstChild;
}

function update_element_html(element, value = '') {
    console.log(`update_element_html()`);
    try {
        element.innerHTML = value;
        console.log(`Successfully updated element innerHTML`);
        return true;
    } catch (err) {
        console.log(`Failed to update element innerHTML`, { original_error: err });
        return false;
    }
}

function close_full_ui() {
    console.log(`close_full_ui()`);
    cancel_downloads = true;
    document.body.style.userSelect = '';

    document.removeEventListener('contextmenu', handle_click);
    document.removeEventListener('scroll', remark_selected_pins);
    document.removeEventListener('drop', remark_selected_pins);
    window.removeEventListener('resize', remark_selected_pins);

    observer?.disconnect();
    observer = null;
    observer_running = false;

    let pins = Array.from(selected_pins.keys());
    unselect_pins(pins);

    document.querySelectorAll('[data-selected-overlay]').forEach(e => e.remove());

    if (stateful_mode) {
        localStorage.setItem('downloaded_pins', JSON.stringify([...downloaded_pins]));
        console.log(`Saved ${downloaded_pins.size} pins to localStorage before closing`);
    } else {
        selected_pins.clear();
        downloaded_pins.clear();
        localStorage.removeItem('downloaded_pins');
    }

    DOM.full_ui_wrapper.self.remove();
    DOM.downloader_button.self.classList.remove('cc_hidden');
    DOM.downloader_button.self.classList.add('cc_visible');

    let downloader_button = DOM.downloader_button.self;
    DOM = DOM_template;
    DOM.downloader_button.self = downloader_button;

    console.log(`Full UI was successfully closed`);
    return;
}