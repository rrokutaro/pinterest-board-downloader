let selected_pins = new Map();
let observer_running = false;
let observer;
let last_pin_received_time = 0;
let last_pin_received_cut_off_duration_ms = (1_000 * 30); // 30s
let timeout_watcher_interval = null;
let auto_scroll_interval = null;
let cancel_downloads = false;
let stateful_mode = true;
let MAX_CONCURRENT_DOWNLOADS = 10;
let downloaded_pins = new Set();

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
    extraction_progress: 'Extracting pin URLs',
    board_count_error: 'Board pin count Not Available',
    board_no_pins: 'No board pins found for this board',
    extraction_error: 'Failed to extract all pins...',
    extraction_error_2: 'Pin extraction stopped: No new pins received',
    extraction_success: 'Successfully extracted all pin URLs!',
    download_progress: 'Downloading pins',
    download_error: 'ERROR: Failed to download all pins...',
    download_success: 'Successfully downloaded pins!',
    waiting_for_pins: 'Waiting for new pins...'
};

const progress_logs = ['cc_log', 'cc_warning', 'cc_error', 'cc_success'];
function logger(level, message, context = {}) {
    const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
    const logMessage = `[PBDL - ${timestamp}] [${level}] ${message}`;
    const contextString = Object.keys(context).length > 0 ? JSON.stringify(context) : '';

    switch (level) {
        case 'ERROR': console.error(logMessage, contextString); break;
        case 'WARN': console.warn(logMessage, contextString); break;
        case 'DEBUG': console.debug(logMessage, contextString); break;
        default: console.log(logMessage, contextString);
    }
}

if (document.readyState === 'interactive' || document.readyState === 'complete') initialize();
else window.addEventListener('DOMContentLoaded', initialize);

function inject_global_styles() {
    const style = document.createElement('style');
    style.id = 'pbdl-global-styles';
    style.innerHTML = `
        :root {
            --cc_fg_main: #333333;
            --cc_fg_sec: #555555;
            --cc_fg_tert: #aaaaaa;
            --cc_bg_main: #FFFFFF;
            --cc_border: #E0E0E0;
            --cc_accent_1: #007BFF;
            --cc_accent_2: #0056b3;
            --cc_bg_accent_2: rgba(0, 123, 255, 0.4);
            --cc_success: #28a745;
            --cc_warning: #E8A600;
            --cc_bg_accent_warning: rgba(232, 166, 0, 0.4);
            --cc_error: #dc3545;
            --cc_fz_9px: clamp(10px, 0.468vw, 12px);
            --cc_fz_12px: clamp(12px, 0.625vw, 15px);
            --cc_fz_16px: clamp(14px, 0.833vw, 18px);
            --cc_fz_24px: clamp(20px, 1.25vw, 28px);
            --cc_fz_40px: clamp(32px, 2.083vw, 48px);
        }
        [data-test-id="pin"] a[href*="/pin/"]:focus-visible {
            outline: none !important;
        }
        a[data-stateful] { 
            cursor: pointer; 
            text-decoration: none; 
            font-weight: bold; 
        }
        a[data-stateful="true"] { 
            color: var(--cc_fg_main) !important; 
        }
        a[data-stateful="false"] { 
            color: var(--cc_fg_tert) !important; 
        }`;

    if (!document.getElementById(style.id)) {
        document.head.appendChild(style);
        logger('INFO', 'Global CSS variables injected.');
    }
}

async function initialize() {
    logger('INFO', 'Pinterest Board Downloader is activating...');
    inject_global_styles();

    const stored_pins = localStorage.getItem('downloaded_pins');
    if (stored_pins) {
        downloaded_pins = new Set(JSON.parse(stored_pins));
        logger('INFO', `Loaded ${downloaded_pins.size} previously downloaded pins from history.`);
    }

    let downloader_button = html_to_element(`<div id="cc_enable_downloader">
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&display=swap');
        div#cc_enable_downloader {
            --cc_fg_main: #333333;
            --cc_fg_sec: #555555;
            --cc_bg_main: #FFFFFF;
            --cc_border: #E0E0E0;
            --cc_accent_1: #007BFF;
            --cc_accent_2: #0056b3;
            --cc_bg_accent_2: rgba(0, 123, 255, 0.4);
            --cc_success: #28a745;
            --cc_warning: #E8A600;
            --cc_bg_accent_warning: rgba(232, 166, 0, 0.4);
            --cc_error: #dc3545;
            --cc_fz_9px: clamp(10px, 0.468vw, 12px);
            --cc_fz_12px: clamp(12px, 0.625vw, 15px);
            --cc_fz_16px: clamp(14px, 0.833vw, 18px);
            --cc_fz_24px: clamp(20px, 1.25vw, 28px);
            --cc_fz_40px: clamp(32px, 2.083vw, 48px);
        }
        .cc_log { color: var(--cc_fg_main) !Important; }
        .cc_warning { color: var(--cc_warning) !Important; }
        .cc_error { color: var(--cc_error) !Important; }
        .cc_success { color: var(--cc_success) !Important; }
        .cc_visible { visibility: visible !Important; }
        .cc_hidden { visibility: hidden !Important; }
        div#cc_enable_downloader,
        div#cc_enable_downloader * {
            padding: 0; margin: 0; box-sizing: border-box; user-select: none; transition: all 250ms ease-in-out;
        }
        div#cc_enable_downloader {
            display: flex; gap: 1rem; justify-content: center; align-items: center; padding: 1rem 1.2rem;
            inline-size: fit-content; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: var(--cc_fz_16px); font-weight: 400; color: var(--cc_fg_main); background-color: var(--cc_bg_main);
            border: 1px solid var(--cc_border); box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1); position: fixed;
            left: 1.5rem; bottom: 1.5rem; cursor: pointer; z-index: 999999;
        }
        div#cc_enable_downloader:hover {
            border-color: var(--cc_accent_1); transform: translateY(-2px); box-shadow: 0 6px 16px rgba(0, 0, 0, 0.12);
        }
        div#cc_enable_downloader:active {
            transform: translateY(0); box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }
        div#cc_enable_downloader #cc_downloader_pinterest_logo {
            width: var(--cc_fz_24px); height: var(--cc_fz_24px);
        }
        div#cc_enable_downloader h2 {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: var(--cc_fz_16px); font-weight: 400; inline-size: fit-content; color: var(--cc_fg_main);
        }
    </style>
    <svg id="cc_downloader_pinterest_logo" viewBox="0 0 30 31" fill="none" xmlns="http://www.w3.org/2000/svg"><g clip-path="url(#clip0_209_463)"><rect y="0.5" width="30" height="30" rx="15" fill="#E9E9E9" /><path d="M9.425 29.4375C9.25834 27.7292 9.36667 26.0917 9.75 24.525L11.25 18.05C10.9749 17.2144 10.8274 16.3421 10.8125 15.4625C10.8125 13.3625 11.825 11.8625 13.425 11.8625C14.525 11.8625 15.3375 12.6375 15.3375 14.1125C15.3375 14.5875 15.2417 15.1208 15.05 15.7125L14.4 17.8625C14.275 18.2792 14.2125 18.6625 14.2125 19.0125C14.2125 20.5125 15.35 21.35 16.8125 21.35C19.425 21.35 21.275 18.65 21.275 15.15C21.275 11.25 18.725 8.75 14.9625 8.75C10.7625 8.75 8.10001 11.4875 8.10001 15.3C8.10001 16.825 8.575 18.25 9.4875 19.225C9.1875 19.7375 8.8625 19.825 8.3875 19.825C6.8875 19.825 5.4625 17.7125 5.4625 14.825C5.4625 9.825 9.46251 5.8625 15.0625 5.8625C20.9375 5.8625 24.6375 9.975 24.6375 15.025C24.6375 20.075 21.0375 23.9625 17.1625 23.9625C16.4251 23.9722 15.6955 23.8101 15.0316 23.489C14.3677 23.1679 13.7877 22.6966 13.3375 22.1125L12.5625 25.2375C12.1744 26.8779 11.488 28.4329 10.5375 29.825C12.7833 30.5304 15.1639 30.6965 17.4859 30.3096C19.8079 29.9228 22.006 28.994 23.9019 27.5986C25.7977 26.2032 27.3379 24.3805 28.3974 22.2784C29.457 20.1763 30.006 17.854 30 15.5C30 11.5218 28.4197 7.70644 25.6066 4.8934C22.7936 2.08035 18.9783 0.5 15 0.5C11.0218 0.5 7.20645 2.08035 4.3934 4.8934C1.58036 7.70644 4.8058e-06 11.5218 4.8058e-06 15.5C-0.0023954 18.4992 0.894324 21.4302 2.57438 23.9146C4.25444 26.3991 6.64068 28.3228 9.425 29.4375Z" fill="#BD081C" /></g><defs><clipPath id="clip0_209_463"><rect y="0.5" width="30" height="30" rx="15" fill="white" /></clipPath></defs></svg>
    <h2 id="cc_downloader_text"> Enable Pinterest<br>Board Downloader</h2>
</div>`);
    downloader_button.addEventListener('click', initialize_full_ui);
    document.body.appendChild(downloader_button);
    DOM.downloader_button.self = downloader_button;
    logger('INFO', 'Downloader is ready. Click the button to open the main UI.');
}

function initialize_full_ui() {
    logger('INFO', 'Opening the downloader user interface...');
    cancel_downloads = false;
    let full_ui_wrapper_elem = html_to_element(`<div id="cc_full_ui_wrapper">
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&display=swap');
        /* --- Styles from previous steps... --- */
        div#cc_full_ui_wrapper *, div#cc_full_ui_wrapper *::before, div#cc_full_ui_wrapper *::after { box-sizing: border-box; margin: 0; padding: 0; transition: all 250ms ease-in-out; user-select: none; }
        div#cc_full_ui_wrapper { background-color: var(--cc_bg_main); border: 1px solid var(--cc_border); block-size: auto; bottom: 1.5rem !important; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15); color: var(--cc_fg_main); font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: var(--cc_fz_12px); inline-size: clamp(320px, 90vw, 480px); left: 1.5rem !important; overflow: hidden; position: fixed !important; z-index: 999999; }
        div#cc_full_ui_wrapper a:hover, div#cc_full_ui_wrapper #cc_select_all_visible_pins_elem:hover { filter: brightness(0.9); }
        div#cc_full_ui_wrapper a:active, div#cc_full_ui_wrapper #cc_select_all_visible_pins_elem:active { transform: scale(0.98); }
        div#cc_full_ui_wrapper #cc_section_1 { padding: 1.5rem; }
        div#cc_full_ui_wrapper header#branding { align-items: center; display: flex; gap: 0.5rem; }
        div#cc_full_ui_wrapper #cc_pinterest_icon { height: var(--cc_fz_16px); width: var(--cc_fz_16px); }
        div#cc_full_ui_wrapper #cc_branding_name { color: var(--cc_fg_main); font-size: var(--cc_fz_16px); }
        div#cc_full_ui_wrapper #cc_manual { color: var(--cc_fg_sec); line-height: 1.5; margin-block-start: 1rem; }
        div#cc_full_ui_wrapper #cc_controls_wrapper { align-items: center; display: flex; gap: 1rem; justify-content: space-around; margin-block-start: 1.5rem; }
        div#cc_full_ui_wrapper .cc_single_control_wrapper { align-items: center; display: flex; flex: 1; flex-direction: column; font-size: var(--cc_fz_9px); text-align: center; }
        div#cc_full_ui_wrapper .cc_count_display { color: var(--cc_fg_main); font-size: var(--cc_fz_40px); }
        div#cc_full_ui_wrapper .cc_download_btn { color: var(--cc_accent_1) !important; cursor: pointer; font-weight: bold; margin-block-start: 0.5rem; text-decoration: none; }
        div#cc_full_ui_wrapper .cc_download_btn:hover { color: var(--cc_accent_2) !important; }
        div#cc_full_ui_wrapper #cc_select_all_visible_pins_elem { color: var(--cc_accent_1); cursor: pointer; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: var(--cc_fz_24px); font-weight: 500; text-align: center; }
        div#cc_full_ui_wrapper #cc_select_all_visible_pins_elem:hover { color: var(--cc_accent_2); }
        div#cc_full_ui_wrapper .cc_v_separator { background-color: var(--cc_border); block-size: 3rem; inline-size: 1px; }
        div#cc_full_ui_wrapper #cc_section_2 { background-color: #F8F9FA; border-block-start: 1px solid var(--cc_border); display: flex; justify-content: center; padding: 1rem 1.5rem; }
        div#cc_full_ui_wrapper #cc_log_wrapper { display: flex; flex-direction: column; gap: 0.5rem; inline-size: 100%; }
        div#cc_full_ui_wrapper #cc_log_wrapper p { color: var(--cc_fg_sec); }
        div#cc_full_ui_wrapper #cc_progress_log_elem { -webkit-box-orient: vertical; -webkit-line-clamp: 2; color: var(--cc_fg_main); display: -webkit-box; font-size: var(--cc_fz_16px); line-height: 1.4; min-height: 2.8em; overflow: hidden; text-overflow: ellipsis; }
        div#cc_full_ui_wrapper #cc_close_btn { color: var(--cc_fg_sec); cursor: pointer; height: 1.5rem; position: absolute; right: 1rem; top: 1rem; width: 1.5rem; }
        div#cc_full_ui_wrapper #cc_close_btn:hover { color: var(--cc_error); }
        div#cc_full_ui_wrapper #cc_close_btn:active { transform: scale(0.9); }
        div#cc_full_ui_wrapper #cc_progress_log_elem.cc_countdown { animation: pulse 1s ease-in-out infinite; }
        @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.7; } 100% { opacity: 1; } }
        .cc_log { color: var(--cc_fg_main) !important; } .cc_warning { color: var(--cc_warning) !important; } .cc_error { color: var(--cc_error) !important; } .cc_success { color: var(--cc_success) !important; } .cc_visible { visibility: visible !important; } .cc_hidden { visibility: hidden !important; }
        
        /* --- NEW/UPDATED FOOTER STYLES --- */
        div#cc_full_ui_wrapper footer#cc_section_3 {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 0.6rem 1.5rem; /* Adjusted padding */
            inline-size: 100%;
            font-size: var(--cc_fz_9px);
            line-height: 1;
            border-block-start: 1px solid var(--cc_border);
            background-color: #F8F9FA;
        }
        div#cc_full_ui_wrapper footer#cc_section_3 a {
            line-height: inherit;
            font-weight: bold;
            cursor: pointer;
            color: var(--cc_fg_sec);
        }
        div#cc_full_ui_wrapper footer#cc_section_3 a:hover {
            color: var(--cc_fg_main);
        }
        div#cc_full_ui_wrapper #cc_history_controls {
            display: flex;
            gap: 1rem;
        }
        @media (max-width: 420px) { div#cc_full_ui_wrapper #cc_controls_wrapper { flex-direction: column; align-items: stretch; gap: 1.5rem; } div#cc_full_ui_wrapper .cc_v_separator { display: none; } }
    </style>
    <!-- The rest of the UI HTML is unchanged -->
    <svg id="cc_close_btn" viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7.5 7.5L13.5 13.5M13.5 7.5L7.5 13.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" /></svg>
    <section id="cc_section_1">
        <header id="branding"><svg id="cc_pinterest_icon" viewBox="0 0 12 R13" fill="none" xmlns="http://www.w3.org/2000/svg"><g clip-path="url(#clip0_214_217)"><rect y="0.5" width="12" height="12" rx="6" fill="#E9E9E9" /><path d="M3.77 12.075C3.70334 11.3917 3.74667 10.7367 3.9 10.11L4.5 7.52C4.38997 7.18576 4.33097 6.83684 4.325 6.485C4.325 5.645 4.73 5.045 5.37 5.045C5.81 5.045 6.135 5.355 6.135 5.945C6.135 6.135 6.09667 6.34833 6.02 6.585L5.76 7.445C5.71 7.61167 5.685 7.765 5.685 7.905C5.685 8.505 6.14 8.84 6.725 8.84C7.77 8.84 8.51 7.76 8.51 6.36C8.51 4.8 7.49 3.8 5.985 3.8C4.305 3.8 3.24 4.895 3.24 6.42C3.24 7.03 3.43 7.6 3.795 7.99C3.675 8.195 3.545 8.23 3.355 8.23C2.755 8.23 2.185 7.385 2.185 6.23C2.185 4.23 3.785 2.645 6.025 2.645C8.375 2.645 9.855 4.29 9.855 6.31C9.855 8.33 8.415 9.885 6.865 9.885C6.57003 9.88889 6.27821 9.82405 6.01265 9.69561C5.74709 9.56717 5.51508 9.37865 5.335 9.145L5.025 10.395C4.86976 11.0511 4.5952 11.6732 4.215 12.23C5.11334 12.5122 6.06554 12.5786 6.99435 12.4239C7.92316 12.2691 8.8024 11.8976 9.56075 11.3394C10.3191 10.7813 10.9352 10.0522 11.359 9.21135C11.7828 8.37051 12.0024 7.44161 12 6.5C12 4.9087 11.3679 3.38258 10.2426 2.25736C9.11742 1.13214 7.5913 0.5 6 0.5C4.4087 0.5 2.88258 1.13214 1.75736 2.25736C0.632143 3.38258 1.92232e-06 4.9087 1.92232e-06 6.5C-0.00095816 7.69967 0.35773 8.87208 1.02975 9.86585C1.70177 10.8596 2.65627 11.6291 3.77 12.075Z" fill="#BD081C" /></g><defs><clipPath id="clip0_214_217"><rect y="0.5" width="12" height="12" rx="6" fill="white" /></clipPath></defs></svg><h1 id="cc_branding_name">Pinterest Board Downloader</h1></header>
        <p id="cc_manual"><b>Right Click + Shift</b> to select/deselect pins. Avoid closing the tab or opening pins while downloading. Hope you find this tool helpful!</p>
        <div id="cc_controls_wrapper"><div id="cc_selected_pins_wrapper" class="cc_single_control_wrapper"><h1 id="cc_currently_selected_pins_count_elem" class="cc_count_display">0</h1><p>Selected Pins</p><a id="cc_download_selected_pins_elem" class="cc_download_btn">Download</a></div><div class="cc_v_separator"></div><div id="cc_board_count_wrapper" class="cc_single_control_wrapper"><h1 id="cc_current_board_count_elem" class="cc_count_display">N/A</h1><p>Pins on Board</p><a id="cc_download_all_pins_elem" class="cc_download_btn">Download All</a></div><div class="cc_v_separator"></div><div id="cc_select_all_visible_pins_wrapper" class="cc_single_control_wrapper"><h1 id="cc_select_all_visible_pins_elem">Select Visible</h1></div></div>
    </section>
    <section id="cc_section_2"><div id="cc_log_wrapper"><p>Progress Log:</p><h1 id="cc_progress_log_elem">No logs to view right now.</h1></div></section>
    
    <!-- UPDATED FOOTER HTML -->
    <footer id="cc_section_3">
        <a id="cc_stateful_btn" data-stateful="true" role="button">Skip Downloaded Pins (Enabled)</a>
        <div id="cc_history_controls">
            <a id="cc_import_btn" role="button">Import</a>
            <a id="cc_export_btn" role="button">Export</a>
            <a id="cc_clear_history_btn" role="button">Clear History</a>
        </div>
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
        update_element_html(DOM.full_ui_wrapper.board_count_wrapper.current_board_count_elem.self, pin_count.formatted_pin_count);
        logger('INFO', `Detected ${pin_count.pin_count} total pins on this board.`);
    } else {
        DOM.full_ui_wrapper.board_count_wrapper.current_board_count_elem.self.innerHTML = 'N/A';
        logger('WARN', 'Could not find the total pin count for this board.');
    }

    DOM.full_ui_wrapper.select_visible_pins_elem.self.addEventListener('click', select_all_visible_pins);
    DOM.full_ui_wrapper.selected_pins_wrapper.start_download_btn.self.addEventListener('click', initialize_downloads);
    DOM.full_ui_wrapper.board_count_wrapper.start_download_btn.self.addEventListener('click', () => extract_board_pins(pin_count?.pin_count));
    DOM.full_ui_wrapper.close_ui_elem.self.addEventListener('click', close_full_ui);
    document.addEventListener('contextmenu', handle_click);

    // This handles re-highlighting on scroll, drop, and resize events.
    document.addEventListener('scroll', remark_selected_pins);
    document.addEventListener('drop', remark_selected_pins);
    window.addEventListener('resize', remark_selected_pins);

    document.body.style.userSelect = 'none';
    DOM.downloader_button.self.classList.add('cc_hidden');
    document.body.appendChild(full_ui_wrapper_elem);

    // --- UPDATED EVENT LISTENERS FOR NEW FOOTER ---
    const state_control_btn = full_ui_wrapper_elem.querySelector('#cc_stateful_btn');
    const import_btn = full_ui_wrapper_elem.querySelector('#cc_import_btn');
    const export_btn = full_ui_wrapper_elem.querySelector('#cc_export_btn');
    const clear_history_btn = full_ui_wrapper_elem.querySelector('#cc_clear_history_btn');

    state_control_btn.addEventListener("click", () => {
        stateful_mode = !stateful_mode;
        if (stateful_mode) {
            state_control_btn.dataset.stateful = "true";
            state_control_btn.innerHTML = "Skip Downloaded Pins (Enabled)";
            logger('INFO', `"Skip Downloaded Pins" is now ON.`);
        } else {
            state_control_btn.dataset.stateful = "false";
            state_control_btn.innerHTML = "Skip Downloaded Pins (Disabled)";
            logger('INFO', `"Skip Downloaded Pins" is now OFF.`);
        }
    });

    import_btn.addEventListener('click', import_history);
    export_btn.addEventListener('click', export_history);
    clear_history_btn.addEventListener('click', clear_history);

    return;
}

function export_history() {
    if (downloaded_pins.size === 0) {
        logger('WARN', 'Export failed: Download history is empty.');
        alert('Your download history is empty. Nothing to export.');
        return;
    }
    const history_array = Array.from(downloaded_pins);
    const history_blob = new Blob([JSON.stringify(history_array, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(history_blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `pinterest_downloader_history_${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    logger('INFO', `Successfully exported ${downloaded_pins.size} pins to JSON.`);
}

function import_history() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = (event) => {
        const file = event.target.files[0];
        if (!file) {
            logger('WARN', 'Import cancelled: No file selected.');
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const imported_data = JSON.parse(e.target.result);
                if (!Array.isArray(imported_data)) {
                    throw new Error('Invalid format: JSON file is not an array.');
                }
                const initial_size = downloaded_pins.size;
                const imported_pins = new Set(imported_data.filter(item => typeof item === 'string'));
                const merged_pins = new Set([...downloaded_pins, ...imported_pins]);

                downloaded_pins = merged_pins;
                localStorage.setItem('downloaded_pins', JSON.stringify([...downloaded_pins]));

                const new_pins_count = downloaded_pins.size - initial_size;
                logger('INFO', `Import successful. Added ${new_pins_count} new pins. Total history is now ${downloaded_pins.size}.`);
                alert(`Import successful!\nAdded ${new_pins_count} new pins.\nTotal history size is now ${downloaded_pins.size}.`);

                remark_selected_pins();

            } catch (error) {
                logger('ERROR', 'Failed to import history from file.', error);
                alert(`Import Failed:\n${error.message}`);
            }
        };
        reader.readAsText(file);
    };
    input.click();
}

function clear_history() {
    const confirmation = confirm("Are you sure you want to clear your entire download history? This action cannot be undone.");
    if (confirmation) {
        downloaded_pins.clear();
        localStorage.removeItem('downloaded_pins');
        logger('INFO', 'Download history has been cleared.');
        alert('Download history has been successfully cleared.');
        // Re-highlight pins to remove the "downloaded" orange overlay
        remark_selected_pins();
    } else {
        logger('INFO', 'User cancelled the history clear action.');
    }
}

async function remark_selected_pins() {
    logger('DEBUG', `Screen changed. Re-highlighting selected pins.`);
    let pin_urls = Array.from(selected_pins?.keys() || []);
    select_pins(pin_urls, true, true);
}

async function handle_click(event) {
    if (event.shiftKey) {
        event.preventDefault();
        const element_below = document.elementFromPoint(event.clientX, event.clientY);
        if (!element_below) return;

        const match = element_below.closest('[data-test-id="pin"]');
        if (match) {
            const pinLink = match.querySelector('a[href*="/pin/"]');
            let pin_url = pinLink?.href || '';

            if (typeof pin_url === 'string' && pin_url.length > 0) {
                pin_url = clean_pin_urls([pin_url])?.at(0);
                if (pin_url) {
                    if (selected_pins.has(pin_url)) {
                        logger('INFO', `Pin unselected: ${pin_url}`);
                        unselect_pins([pin_url]);
                    } else {
                        const is_downloaded = downloaded_pins.has(pin_url);
                        logger('INFO', `Pin selected: ${pin_url} (Already downloaded: ${is_downloaded})`);
                        select_pins([pin_url]);
                    }
                }
            }
        }
    }
}

async function extract_board_pins(pin_count) {
    logger('INFO', `Starting automatic search for all ${pin_count} pins on the board...`);
    if (!Number.isInteger(pin_count) || pin_count <= 0) {
        logger('ERROR', `Cannot start search: Invalid pin count provided.`, { pin_count });
        update_element_html(DOM.full_ui_wrapper.board_count_wrapper.current_board_count_elem.self, 'N/A');
        DOM.full_ui_wrapper.progress_log_elem.self.className = 'cc_error';
        update_element_html(DOM.full_ui_wrapper.progress_log_elem.self, message_template.board_count_error);
        return;
    }

    if (!stateful_mode) {
        selected_pins.clear();
        logger('INFO', `Cleared selection list because "Skip Downloaded Pins" is off.`);
    }

    observer = new MutationObserver((mutation_records) => {
        let pin_urls = new Set();
        let current_time = Date.now();
        for (let record of mutation_records) {
            if (record.type !== 'childList') continue;
            for (let node of record.addedNodes) {
                if (node.nodeType !== Node.ELEMENT_NODE) continue;
                let matches = Array.from(node.querySelectorAll('[data-test-id="pin"] a[href*="/pin/"]')).map(link => link?.href).filter(Boolean);
                if (matches.length > 0) {
                    clean_pin_urls(matches).forEach(url => pin_urls.add(url));
                    last_pin_received_time = current_time;
                }
            }
        }

        if (pin_urls.size > 0) {
            select_pins([...pin_urls]);
            let extraction_percentage = ((selected_pins.size / pin_count) * 100).toFixed(2);
            logger('INFO', `Found ${pin_urls.size} new pins. Total found: ${selected_pins.size} of ${pin_count}.`);
            DOM.full_ui_wrapper.progress_log_elem.self.className = 'cc_log';
            update_element_html(DOM.full_ui_wrapper.progress_log_elem.self, `${message_template.extraction_progress}: ${extraction_percentage}% (${selected_pins.size}/${pin_count} pins)`);
        }

        if (selected_pins.size >= pin_count) {
            logger('INFO', `Search complete! Found all ${selected_pins.size} pins.`);
            clearInterval(timeout_watcher_interval);
            clearInterval(auto_scroll_interval);
            observer?.disconnect();
            observer = null;
            observer_running = false;
            DOM.full_ui_wrapper.progress_log_elem.self.className = 'cc_success';
            update_element_html(DOM.full_ui_wrapper.progress_log_elem.self, message_template.extraction_success);
            initialize_downloads();
            if (!stateful_mode) unselect_pins(Array.from(selected_pins.keys()));
        }
    });

    let target_elem = document.querySelector('[data-test-id="board-feed"]') || document.body;
    let observer_options = { childList: true, subtree: true };
    select_all_visible_pins();
    observer_running = true;
    last_pin_received_time = Date.now();
    observer.observe(target_elem, observer_options);
    logger('INFO', `Scrolling page to find all pins. Please do not close this tab.`);

    startTimeoutWatcher();

    window.scrollTo({ top: 0 });
    await new Promise((res) => setTimeout(res, 500));
    start_auto_scrolling();
}

function startTimeoutWatcher() {
    if (timeout_watcher_interval) clearInterval(timeout_watcher_interval);

    timeout_watcher_interval = setInterval(async () => {
        if (!observer_running) {
            clearInterval(timeout_watcher_interval);
            return;
        }

        const time_passed = Date.now() - last_pin_received_time;
        if (time_passed > last_pin_received_cut_off_duration_ms) {
            logger('WARN', `Search stopped: No new pins were found in the last ${Math.round(last_pin_received_cut_off_duration_ms / 1000)} seconds.`);
            clearInterval(timeout_watcher_interval);
            clearInterval(auto_scroll_interval);
            observer?.disconnect();
            observer = null;
            observer_running = false;
            DOM.full_ui_wrapper.progress_log_elem.self.className = 'cc_warning';
            update_element_html(DOM.full_ui_wrapper.progress_log_elem.self, `Pin search stopped. Proceeding to download ${selected_pins.size} found pins.`);
            await initialize_downloads();
        } else if (time_passed > 5000) {
            const time_remaining = Math.max(0, last_pin_received_cut_off_duration_ms - time_passed);
            const seconds_remaining = Math.ceil(time_remaining / 1000);
            DOM.full_ui_wrapper.progress_log_elem.self.className = 'cc_log cc_countdown';
            update_element_html(DOM.full_ui_wrapper.progress_log_elem.self, `${message_template.waiting_for_pins} ${seconds_remaining}s`);
        }
    }, 2000);
}

function start_auto_scrolling(delay = 1000, human_behavior = true) {
    if (auto_scroll_interval) clearInterval(auto_scroll_interval);

    auto_scroll_interval = setInterval(() => {
        if (!observer_running || cancel_downloads) {
            clearInterval(auto_scroll_interval);
            logger('WARN', `Auto-scrolling has been stopped.`);
            return;
        }

        const isAtBottom = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 100;

        if (!isAtBottom) {
            const px = window.innerHeight * 0.75;
            let altered_px = human_behavior ? px + (Math.random() * px * 0.2) : px;
            window.scrollTo({ top: window.scrollY + altered_px, behavior: 'smooth' });
        }
    }, delay);
}

async function initialize_downloads() {
    logger('INFO', 'Preparing to download selected pins...');
    if (selected_pins.size === 0) {
        logger('WARN', 'Download cancelled: No pins are selected.');
        DOM.full_ui_wrapper.progress_log_elem.self.className = 'cc_log';
        update_element_html(DOM.full_ui_wrapper.progress_log_elem.self, message_template.select_error);
        return;
    }

    const download_items = [];
    for (const pin of selected_pins.values()) {
        const should_download = !stateful_mode || !downloaded_pins.has(pin.url);
        if (should_download) {
            if (pin.image_url) download_items.push({ media_url: pin.image_url, pin_url: pin.url });
            if (pin.video_url) download_items.push({ media_url: pin.video_url, pin_url: pin.url });
        } else {
            logger('INFO', `Skipping (already downloaded): ${pin.url}`);
        }
    }

    logger('INFO', `Found ${download_items.length} files to download.`);

    if (download_items.length === 0) {
        DOM.full_ui_wrapper.progress_log_elem.self.className = 'cc_success';
        update_element_html(DOM.full_ui_wrapper.progress_log_elem.self, 'All selected pins have already been downloaded.');
        return;
    }

    try {
        let download_response = await download_pins(download_items);
        logger('INFO', 'Download process finished.', download_response);
        DOM.full_ui_wrapper.progress_log_elem.self.className = 'cc_success';
        update_element_html(DOM.full_ui_wrapper.progress_log_elem.self, message_template.download_success);
        localStorage.setItem('downloaded_pins', JSON.stringify([...downloaded_pins]));
        logger('INFO', `Updated download history. Total history size: ${downloaded_pins.size} pins.`);
    } catch (err) {
        logger('ERROR', 'The download process failed.', { original_error: err });
        DOM.full_ui_wrapper.progress_log_elem.self.className = 'cc_error';
        update_element_html(DOM.full_ui_wrapper.progress_log_elem.self, message_template.download_error);
    }
}


function inject_selected_overlay(parentElement, is_downloaded = false, random = false) {
    if (!parentElement || parentElement.querySelector('[data-selected-overlay]')) return;

    if (window.getComputedStyle(parentElement).position !== 'relative') {
        parentElement.style.position = 'relative';
        parentElement.style.zIndex = '2';
    }

    const bgColor = is_downloaded ? 'var(--cc_bg_accent_warning)' : 'var(--cc_bg_accent_2)';
    const borderColor = is_downloaded ? 'var(--cc_warning)' : 'var(--cc_accent_1)';

    const newDiv = document.createElement('div');
    newDiv.setAttribute('data-selected-overlay', 'selected_overlay');
    Object.assign(newDiv.style, {
        position: 'absolute',
        top: '0',
        left: '0',
        width: '100%',
        height: '100%',
        zIndex: '999999',
        backgroundColor: bgColor,
        boxShadow: `inset 0 0 0 clamp(5px, 0.6vw, 7px) ${borderColor}`,
        pointerEvents: 'none',
        opacity: '0',
        transition: `opacity ${random ? (200 + Math.random() * 100) : 150}ms ease-in-out`,
    });

    let targetBorderRadius = window.getComputedStyle(parentElement).borderRadius;
    for (const descendant of parentElement.querySelectorAll('*')) {
        const currentRadius = window.getComputedStyle(descendant).borderRadius;
        if (currentRadius !== '0px' && currentRadius !== 'none') {
            targetBorderRadius = currentRadius;
            break;
        }
    }
    newDiv.style.borderRadius = targetBorderRadius;

    parentElement.prepend(newDiv);

    requestAnimationFrame(() => {
        newDiv.style.opacity = '1';
    });
}

function select_all_visible_pins() {
    logger('INFO', 'Selecting all pins currently visible on the screen...');
    let pin_urls = Array.from(document.querySelectorAll('[data-test-id="pin"] a[href*="/pin/"]'))
        .map(link => link?.href)
        .filter(Boolean);

    if (pin_urls.length > 0) {
        select_pins(pin_urls);
        logger('INFO', `Selected ${pin_urls.length} visible pins.`);
    } else {
        logger('INFO', 'No visible pins found to select.');
    }
}

async function select_pins(pin_urls, reselect = false, subtle = true) {
    pin_urls = clean_pin_urls(pin_urls);
    let selection_changed = false;

    for (let url of new Set(pin_urls)) {
        const gridItem = document.querySelector(`[data-test-id="pin"]:has(a[href*="${url}"])`);
        if (!gridItem) continue;

        const overlayHost = gridItem.querySelector('a[href*="/pin/"]');
        if (!overlayHost) continue;

        const is_downloaded = downloaded_pins.has(url);

        if (reselect) {
            inject_selected_overlay(overlayHost, is_downloaded, subtle);
            continue;
        }

        if (selected_pins.has(url)) continue;

        selection_changed = true;
        let img = gridItem.querySelector('img');
        let img_srcset = img?.srcset || img?.src || '';
        let video_url = gridItem.querySelector('video')?.src || '';
        let image_url = img_srcset ? parse_srcset(img_srcset, true) : '';

        if (!image_url && !video_url) {
            logger('WARN', `Could not find any image or video URL for pin: ${url}`);
            continue;
        }

        selected_pins.set(url, { url, image_url, video_url, timestamp: Date.now() });
        inject_selected_overlay(overlayHost, is_downloaded, subtle);
    }

    if (selection_changed) {
        update_currently_selected_pins();
        DOM.full_ui_wrapper.progress_log_elem.self.className = 'cc_log';
        update_element_html(DOM.full_ui_wrapper.progress_log_elem.self, message_template.selection_success);
    }
}

function update_currently_selected_pins() {
    let pin_count = selected_pins?.size || 0;
    let formatted_pin_count;
    if (pin_count >= 1_000_000_000) formatted_pin_count = `${(pin_count / 1_000_000_000).toFixed(2)}B`;
    else if (pin_count >= 1_000_000) formatted_pin_count = `${(pin_count / 1_000_000).toFixed(2)}M`;
    else if (pin_count >= 1_000) formatted_pin_count = `${(pin_count / 1_000).toFixed(2)}k`;
    else formatted_pin_count = `${pin_count}`;

    update_element_html(DOM.full_ui_wrapper.selected_pins_wrapper.currently_selected_pins_count_elem.self, formatted_pin_count);
    logger('DEBUG', `UI updated to show ${pin_count} selected pins.`);
}

function unselect_pins(pin_urls, random = true) {
    pin_urls = clean_pin_urls(pin_urls);
    let removal_count = 0;

    for (let url of new Set(pin_urls)) {
        selected_pins.delete(url);
        const matches = document.querySelectorAll(`[data-test-id="pin"]:has(a[href*="${url}"])`);
        for (let match of matches) {
            const overlayHost = match.querySelector('a[href*="/pin/"]');
            if (!overlayHost) continue;

            let overlay = overlayHost.querySelector('[data-selected-overlay]');
            if (overlay) {
                let duration = random ? (300 + Math.random() * 100) : 150;
                overlay.style.transition = `opacity ${duration}ms ease-in-out`;
                overlay.style.opacity = '0';
                setTimeout(() => { overlay.remove(); }, duration);
                removal_count++;
            }
        }
    }

    if (removal_count > 0) update_currently_selected_pins();

    DOM.full_ui_wrapper.progress_log_elem.self.className = 'cc_log';
    update_element_html(DOM.full_ui_wrapper.progress_log_elem.self, message_template.clear);
}

function clean_pin_urls(urls) {
    return urls
        .filter(url => typeof url === 'string' && url.length > 0)
        .map(url => url.match(/pin\/[^/]+\/?/)?.[0]?.replace(/\/$/, ''))
        .filter(Boolean);
}

function parse_srcset(srcset, best_quality = true) {
    if (typeof srcset !== 'string' || !srcset) return null;

    let urls = srcset.split(',').map(part => part.trim().replace(/\s+\d+[wx]$/, ''))
        .filter(url => url && url.includes('pinimg.com'));

    if (urls.length === 0) return null;

    if (best_quality) {
        urls.sort((a, b) => {
            if (a.includes('/originals/')) return -1;
            if (b.includes('/originals/')) return 1;
            const aRes = a.match(/\/(\d+)x\//)?.[1] || 0;
            const bRes = b.match(/\/(\d+)x\//)?.[1] || 0;
            return parseInt(bRes) - parseInt(aRes);
        });
    }
    return urls[0] || null;
}

async function download_pins(items) {
    logger('INFO', `Starting download of ${items.length} files. This may take a moment...`);
    let failed_downloads = 0;
    let successful_downloads = 0;

    const chunks = [];
    for (let i = 0; i < items.length; i += MAX_CONCURRENT_DOWNLOADS) {
        chunks.push(items.slice(i, i + MAX_CONCURRENT_DOWNLOADS));
    }

    for (let i = 0; i < chunks.length; i++) {
        if (cancel_downloads) {
            logger('WARN', 'Download process was cancelled by the user.');
            break;
        }

        const chunk = chunks[i];
        const promises = chunk.map(async (item) => {
            try {
                const response = await fetch(item.media_url, { mode: 'cors' });
                if (!response.ok) throw new Error(`Server responded with status ${response.status}`);
                const blob = await response.blob();
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                const fileName = item.media_url.split('/').pop().split('?')[0] || `pin_${Date.now()}`;
                link.download = fileName;
                document.body.appendChild(link);
                link.click();
                await new Promise(resolve => setTimeout(resolve, 200));
                document.body.removeChild(link);
                URL.revokeObjectURL(link.href);

                downloaded_pins.add(item.pin_url);

                const overlayHost = document.querySelector(`[data-test-id="pin"]:has(a[href*="${item.pin_url}"]) a[href*="/pin/"]`);
                if (overlayHost) {
                    overlayHost.querySelector('[data-selected-overlay]')?.remove();
                    inject_selected_overlay(overlayHost, true);
                }

                return true;
            } catch (error) {
                logger('ERROR', `Download failed for ${item.media_url}`, error);
                return false;
            }
        });

        const results = await Promise.all(promises);
        successful_downloads += results.filter(r => r).length;
        failed_downloads += results.filter(r => !r).length;

        const progress_percentage = Math.min(100, (((i + 1) * MAX_CONCURRENT_DOWNLOADS / items.length) * 100));
        DOM.full_ui_wrapper.progress_log_elem.self.className = 'cc_log';
        update_element_html(DOM.full_ui_wrapper.progress_log_elem.self, `${message_template.download_progress}: ${progress_percentage.toFixed(0)}%`);
    }

    if (failed_downloads > 0) {
        throw new Error(`${failed_downloads} out of ${items.length} downloads failed. Check the console for details.`);
    }
    return { failed_downloads, successful_downloads };
}

function get_board_pin_count() {
    logger('DEBUG', 'Attempting to find the total pin count for this board...');
    const pinCountRegex = /[\d,]+\s*pin/i;
    let pin_count_element = document.querySelector('[data-test-id="pin-count"]');
    let pin_count_text = pin_count_element?.innerText || document.body.innerText.match(pinCountRegex)?.[0];
    if (!pin_count_text) return null;

    let pin_count = parseInt(pin_count_text.replace(/[,\sA-Za-z]/g, ''));
    if (!Number.isInteger(pin_count)) return null;

    let formatted_pin_count;
    if (pin_count >= 1_000_000_000) formatted_pin_count = `${(pin_count / 1_000_000_000).toFixed(2)}B`;
    else if (pin_count >= 1_000_000) formatted_pin_count = `${(pin_count / 1_000_000).toFixed(2)}M`;
    else if (pin_count >= 1_000) formatted_pin_count = `${(pin_count / 1_000).toFixed(1)}k`;
    else formatted_pin_count = `${pin_count}`;

    return { pin_count, formatted_pin_count };
}

function html_to_element(htmlString) {
    const template = document.createElement('template');
    template.innerHTML = htmlString.trim();
    return template.content.firstChild;
}

function update_element_html(element, value = '') {
    if (!element) return;
    try {
        element.innerHTML = value;
    } catch (err) {
        logger('ERROR', `Failed to update a UI element.`, { original_error: err });
    }
}

function close_full_ui() {
    logger('INFO', 'Closing the downloader UI...');
    cancel_downloads = true;
    document.body.style.userSelect = '';

    document.removeEventListener('contextmenu', handle_click);
    document.removeEventListener('scroll', remark_selected_pins);
    document.removeEventListener('drop', remark_selected_pins);
    window.removeEventListener('resize', remark_selected_pins);

    clearInterval(timeout_watcher_interval);
    clearInterval(auto_scroll_interval);
    observer?.disconnect();
    observer = null;
    observer_running = false;

    unselect_pins(Array.from(selected_pins.keys()));
    document.querySelectorAll('[data-selected-overlay]').forEach(e => e.remove());

    localStorage.setItem('downloaded_pins', JSON.stringify([...downloaded_pins]));
    logger('INFO', `Saved download history of ${downloaded_pins.size} pins.`);

    selected_pins.clear();

    DOM.full_ui_wrapper.self.remove();
    DOM.downloader_button.self.classList.remove('cc_hidden');

    let downloader_button = DOM.downloader_button.self;
    DOM = DOM_template;
    DOM.downloader_button.self = downloader_button;
    logger('INFO', 'Downloader UI is now closed.');
}
