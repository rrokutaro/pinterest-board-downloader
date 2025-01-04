let selected_pins = new Map();
let observer_running = false;
let observer;
let last_pin_received_time = 0;
let last_pin_received_cut_off_duration_ms = (1_000 * 45); // 45s (if no new pins are received or added for over 45 seconds, pin extraction stops and moves on to the download phase)
let cancel_downloads = false;

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
    board_count_error: 'ERROR: Board pin count is not available',
    board_no_pins: 'No board pins were found for this board',
    extraction_error: 'ERROR: Failed to extract all pins...',
    extraction_error_2: 'Pin extraction process took too long.',
    extraction_success: 'Successfully extracted pins!',
    download_progress: 'Downloading pins',
    download_error: 'ERROR: Failed to download all pins...',
    download_success: 'Successfully downloaded pins!'
};

let progress_logs = ['cc_log', 'cc_warning', 'cc_error', 'cc_success'];
if (document.readyState === 'complete') initialize();
else window.addEventListener('load', initialize);

async function initialize() {
    console.log(`initialize()`);
    let downloader_button = html_to_element(`<div id="cc_enable_downloader">
    <style>
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

            font-family: 'SF Pro Display Regular';
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
            font-family: 'SF Pro Display Regular';
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
    // Create UI elements

    let full_ui_wrapper_elem = html_to_element(`<div id="cc_full_ui_wrapper">
    <style>
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
            font-family: 'SF Pro Display';
            font-size: var(--cc_fz_12px);
            color: var(--cc_fg_main);
            background-color: #343434;
            outline: 0.052vw solid var(--cc_fg_main);

            inline-size: 24.74vw;
            block-size: 19.427vw;

            min-inline-size: 24.74vw;
            min-block-size: 19.427vw;

            position: fixed;
            left: 1.146vw;
            bottom: 1.146vw;
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
            font-family: 'SF Pro Display Medium';
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
            /* Create a flexible box */
            -webkit-box-orient: vertical;
            /* Orient the box vertically */
            -webkit-line-clamp: 2;
            /* Limit to 2 lines */
            overflow: hidden;
            /* Hide the overflow text */
            text-overflow: ellipsis;
            /* Add ellipses to indicate text truncation */
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
        <span>If you find this product helpful to your workflow, kindly support me by</span> <a
            href="https://buymeacoffee.com/" target="_blank">buying me a coffee</a>.
    </footer>
</div>`);

    // Prepare DOM to be used
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

    // Get and update the board count
    let pin_count = get_board_pin_count();
    if (pin_count?.pin_count >= 0) {
        let update_response = update_element_html(DOM.full_ui_wrapper.board_count_wrapper.current_board_count_elem.self, pin_count.formatted_pin_count);
        if (update_response === false) console.log(`Element for displaying board count not found or we failed to set the board count. No need to worry, the board pin count is: ${pin_count.pin_count}. Downloading of all pins within the board will still be possible`);
        else console.log(`Element for displaying board count has been updated with the latest board pin count`);
    } else {
        DOM.full_ui_wrapper.board_count_wrapper.current_board_count_elem.self.innerHTML = 'N/A';
        console.log(`Board pin count not found! Selecting the download all pins will not run`);
    }

    // Event listeners on UI elements
    DOM.full_ui_wrapper.select_visible_pins_elem.self.addEventListener('click', select_all_visible_pins);
    DOM.full_ui_wrapper.selected_pins_wrapper.start_download_btn.self.addEventListener('click', initialize_downloads);
    DOM.full_ui_wrapper.board_count_wrapper.start_download_btn.self.addEventListener('click', () => extract_board_pins(pin_count?.pin_count));
    DOM.full_ui_wrapper.close_ui_elem.self.addEventListener('click', close_full_ui);
    document.addEventListener('contextmenu', handle_click);
    document.addEventListener('scroll', remark_selected_pins);
    document.addEventListener('drop', remark_selected_pins);
    window.addEventListener('resize', remark_selected_pins);

    // Prevents selecting ui elements (marquee over)
    document.body.style.userSelect = 'none';
    DOM.downloader_button.self.classList.remove('cc_visible');
    DOM.downloader_button.self.classList.add('cc_hidden');
    document.body.appendChild(full_ui_wrapper_elem);
    return;
}

async function remark_selected_pins() {
    console.log(`remark_selected_pins()`);
    let pin_urls = Array.from(selected_pins?.keys() || []);
    select_pins(pin_urls, true);
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
        } return true;
    }
}

async function extract_board_pins(pin_count) {
    console.log(`extract_board_pins()`);
    if (pin_count > 0) {
        observer = new MutationObserver(async (mutation_records) => {
            for (let record of mutation_records) {
                if (record.type === 'childList') {
                    let added_nodes = (Array.from(record?.addedNodes || []));
                    let pin_urls = [];
                    node_loop: for (let node of added_nodes) {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            console.log(`New element added`);
                            let match = node.closest('[data-grid-item]:has(a[href*="/pin/"])');
                            if (match) {
                                let pin_url = match.querySelector('a[href*="/pin/"]')?.href;
                                if ((typeof pin_url === 'string') && (pin_url?.length > 0)) pin_urls.push(pin_url);
                                else console.log(`Pin url is invalid`, { pin_url });
                                last_pin_received_time = Date.now();
                                continue node_loop;
                            } else {
                                let matches = Array.from(node.querySelectorAll('a[href*="/pin/"]') || []);
                                if (matches?.length > 0) {
                                    matches = matches.map(link => link?.href).filter(e => ((typeof e === 'string') && (e?.length > 0)));
                                    last_pin_received_time = Date.now();
                                    if (matches?.length > 0) pin_urls.push(...matches);
                                }
                            }
                        }
                    }

                    if (pin_urls?.length > 0) {
                        select_pins(pin_urls);
                        let extraction_percentage = ((selected_pins.size / pin_count) * 100).toFixed(2);
                        DOM.full_ui_wrapper.progress_log_elem.self.classList.remove(...progress_logs);
                        DOM.full_ui_wrapper.progress_log_elem.self.classList.add('cc_log');
                        DOM.full_ui_wrapper.progress_log_elem.self.innerHTML = `${message_template.extraction_progress}, ${extraction_percentage}%`;
                    }

                    if (selected_pins.size >= pin_count) {
                        console.log('Successfully extracted all pins');
                        observer?.disconnect();
                        observer = null;
                        observer_running = false;

                        DOM.full_ui_wrapper.progress_log_elem.self.classList.remove(...progress_logs);
                        DOM.full_ui_wrapper.progress_log_elem.self.classList.add('cc_success');
                        DOM.full_ui_wrapper.progress_log_elem.self.innerHTML = message_template.extraction_success;

                        await initialize_downloads();
                        unselect_pins(Array.from(selected_pins.keys() || []));
                        return true;
                    }
                }
            }
        });

        let target_elem = document.body;
        let observer_options = { childList: true, subtree: true };
        select_all_visible_pins();
        observer_running = true;
        last_pin_received_time = Date.now();
        observer.observe(target_elem, observer_options);
        let response = await scroll_down(500);
        return true;
    } else {
        console.log(`Board pin count is not available, cannot process to extract pins..`);
        DOM.full_ui_wrapper.progress_log_elem.self.classList.remove(...progress_logs);
        if (pin_count === 0) {
            DOM.full_ui_wrapper.progress_log_elem.self.classList.add('cc_log');
            DOM.full_ui_wrapper.progress_log_elem.self.innerHTML = message_template.board_no_pins;
        } else {
            DOM.full_ui_wrapper.progress_log_elem.self.classList.add('cc_error');
            DOM.full_ui_wrapper.progress_log_elem.self.innerHTML = message_template.board_count_error;
        }

        DOM.full_ui_wrapper.board_count_wrapper.current_board_count_elem.self.innerHTML = 'N/A';
        return false;
    }
}

async function scroll_down(delay = 500, human_behavior = true, px = (window.innerHeight / 2)) {
    console.log(`scroll_down()`);
    if ((observer_running === true)) {
        if (cancel_downloads === false) {
            let time_passed_since_last_pin_received = Date.now() - last_pin_received_time;
            console.log({ time_passed_since_last_pin_received: `${(time_passed_since_last_pin_received / 1e3)}s` });
            if (time_passed_since_last_pin_received > last_pin_received_cut_off_duration_ms) {
                console.log(`Too much time has timed since the last pin was received, operation must now end`);
                observer?.disconnect();
                observer = null;
                observer_running = false;

                DOM.full_ui_wrapper.progress_log_elem.self.classList.remove(...progress_logs);
                DOM.full_ui_wrapper.progress_log_elem.self.classList.add('cc_warning');
                DOM.full_ui_wrapper.progress_log_elem.self.innerHTML = message_template.extraction_error_2;
                await initialize_downloads(); // Downloads what was extracted regardless
                return true;
            }

            if (selected_pins?.size > 50) {
                let old_pins = Array.from(selected_pins.keys() || []).slice(0, 25);
                for (let pin of old_pins) {
                    let match = document.querySelector(`a[href*="${pin}"]`);
                    match?.remove();
                }
            }

            // Scroll...
            let altered_px = (human_behavior === true) ? (px + (Math.random() * px)) : px;
            let altered_delay = (human_behavior === true) ? (delay + (Math.random() * delay)) : delay;
            window.scrollBy(0, altered_px);
            window.scrollBy(0, -(window.innerHeight * 0.3));
            await new Promise((resolve) => setTimeout(resolve, altered_delay));
            scroll_down(delay, human_behavior, px);
        } else {
            console.log(`Scroll down operation shutting down..`);
            return true;
        }
    } else {
        console.log(`Scroll down operation shutting down..`);
        return true;
    }
}

async function initialize_downloads() {
    console.log(`initialize_downloads()`);
    if (selected_pins.size > 0) {
        let currently_selected_pins = Array.from(selected_pins.values());
        let image_urls = currently_selected_pins.map(pin => pin.image_url).filter(e => ((typeof e === 'string') && (e?.length > 0)));
        let video_urls = currently_selected_pins.map(pin => pin.video_urls).filter(e => ((typeof e === 'string') && (e?.length > 0)));
        let download_urls = image_urls.concat(video_urls);
        let total_pins = download_urls.length;
        console.log({ download_urls, total: total_pins });

        try {
            let download_response = await download_pins(download_urls);
            console.log(message_template.download_success, download_response);
            DOM.full_ui_wrapper.progress_log_elem.self.classList.remove(...progress_logs);
            DOM.full_ui_wrapper.progress_log_elem.self.classList.add('cc_success');
            DOM.full_ui_wrapper.progress_log_elem.self.innerHTML = message_template.download_success;
            return true;
        } catch (err) {
            console.log(message_template.download_error, { original_error: err });
            DOM.full_ui_wrapper.progress_log_elem.self.classList.remove(...progress_logs);
            DOM.full_ui_wrapper.progress_log_elem.self.classList.add('cc_error');
            DOM.full_ui_wrapper.progress_log_elem.self.innerHTML = message_template.download_error;
            return false;
        }
    } else {
        console.log(message_template.select_error);
        DOM.full_ui_wrapper.progress_log_elem.self.classList.remove(...progress_logs);
        DOM.full_ui_wrapper.progress_log_elem.self.classList.add('cc_log');
        DOM.full_ui_wrapper.progress_log_elem.self.innerHTML = message_template.select_error;
        return true;
    }
}

function inject_selected_overlay(parentElement) {
    console.log(`inject_selected_overlay()`);
    // Create the new div element
    const newDiv = document.createElement('div');
    newDiv.setAttribute('data-selected-overlay', 'selected_overlay');

    // Apply the styles to the new div
    newDiv.style.position = 'absolute';           // Position it absolutely
    newDiv.style.top = '0';                       // Adjust the top position as needed
    newDiv.style.left = '0';                      // Adjust the left position as needed
    newDiv.style.width = '100%';                  // Set width to 100% of the parent (can be adjusted)
    newDiv.style.height = '100%';                 // Set height to 100% of the parent (can be adjusted)
    newDiv.style.zIndex = '999999';                 // Set the highest z-index
    newDiv.style.backgroundColor = 'rgba(52, 135, 233, 0.5)';  // Set background color
    newDiv.style.border = '0px solid #3487E9';    // Inner border
    newDiv.style.boxShadow = 'inset 0 0 0 0.3646vw #3487E9';
    newDiv.style.borderRadius = '0.833vw';
    newDiv.pointerEvents = 'none';

    // Append the new div to the parent element
    parentElement.appendChild(newDiv);
    return true;
}

function select_all_visible_pins() {
    console.log(`select_all_visible_pins()`);
    let pin_urls = Array.from(document.querySelectorAll('[data-grid-item] a[href*="/pin/"]') || []).map(link => {
        link = link?.href;
        if ((typeof link === 'string') && (link?.length > 0)) return link;
        else return null;
    }).filter(e => (typeof e === 'string'));

    if (pin_urls?.length > 0) {
        select_pins(pin_urls);
        console.log(`Selected all visible pins`);
    } else console.log(`No visible pins found to select`);
    return true;
}

function select_pins(pin_urls, reselect = false) {
    console.log(`select_pins()`, { pin_urls });
    let selected_count = 0;
    pin_urls = clean_pin_urls(pin_urls);
    console.log({ pin_urls_cleaned: pin_urls });

    pin_loop: for (let url of pin_urls) {
        let match = document.querySelector(`[data-grid-item]:has(a[href*="${url}"])`);
        if (reselect === true) {
            if (match) {
                let inject_overlay = match.querySelector('[data-selected-overlay]');
                if (inject_overlay) console.log(`Pin wrapper is already selected. No need to reselect`);
                else inject_selected_overlay(match);
                selected_count++;
            } else console.log(`No visual pin element containing the pin url: ${url} was found. Cannot reselect`);
        } else {
            if (match) {
                let img = match.querySelector(`a[href*="${url}"] img`);
                let img_srcset = (img?.srcset || img?.src);
                console.log({ img_srcset });
                if ((typeof img_srcset == 'string') && (img_srcset?.length > 0)) {
                    img_srcset = parse_srcset(img_srcset, true); // [4x, 3x, 2x, etc]
                    if (!(Array.isArray(img_srcset) && (img_srcset?.length > 0))) {
                        console.error(`Failed to get post download information for pin: ${url}, therefore cannot select pin`);
                        selected_pins.delete(url);
                        unselect_pins([url]);
                        continue pin_loop;
                    }

                    if (selected_pins?.has(url)) {
                        console.log(`Pin already selected, will not add to map`);
                    } else {
                        console.log(`New pin is not selected, will be selected...`);
                        selected_pins.set(url, { url, image_url: img_srcset.at(0) });
                    }

                    let inject_overlay = match.querySelector('[data-selected-overlay]');
                    if (inject_overlay) console.log(`Pin wrapper is already selected. No need to reselect`);
                    else inject_selected_overlay(match);
                    selected_count++;
                } else {
                    console.error(`Failed to get post download information for url: ${url}, therefore cannot select pin`);
                    continue pin_loop;
                }
            } else console.log(`No visual pin element containing the pin url: ${url} was found`);
            console.log({ selected_pins });
        }
    }

    update_currently_selected_pins();
    DOM.full_ui_wrapper.progress_log_elem.self.classList.remove(...progress_logs);
    DOM.full_ui_wrapper.progress_log_elem.self.classList.add('cc_log');
    if (selected_count > 0) DOM.full_ui_wrapper.progress_log_elem.self.innerHTML = message_template.selection_success;
    else DOM.full_ui_wrapper.progress_log_elem.self.innerHTML = message_template.clear;
    return true;
}

function update_currently_selected_pins() {
    console.log(`update_currently_selected_pins()`);
    DOM.full_ui_wrapper.selected_pins_wrapper.currently_selected_pins_count_elem.self.innerHTML = `${selected_pins?.size || 0}`;
    return true;
}

function unselect_pins(pin_urls) {
    console.log('unselect_pins()');
    let removal_count = 0;
    pin_urls = clean_pin_urls(pin_urls);
    pin_loop: for (let url of pin_urls) {
        selected_pins.delete(url);
        let matches = document.querySelectorAll(`[data-grid-item]:has(a[href*="${url}"])`);
        matches = Array.from(matches || []);
        removal_loop: for (let match of matches) {
            let inject_overlay = match.querySelector('[data-selected-overlay]');
            if (inject_overlay) {
                inject_overlay?.remove();
                removal_count++;
            }
        }
    }

    if (removal_count > 0) {
        console.log(`Successfully unselected pins`);
        update_currently_selected_pins();
    } else console.log(`No pins were unselected`);

    DOM.full_ui_wrapper.progress_log_elem.self.classList.remove(...progress_logs);
    DOM.full_ui_wrapper.progress_log_elem.self.classList.add('cc_log');
    DOM.full_ui_wrapper.progress_log_elem.self.innerHTML = message_template.clear;
    console.log({ selected_pins });
    return true;
}

function clean_pin_urls(urls) {
    console.log(`clean_pin_urls()`);
    let clean_urls = [];
    for (let url of urls) {
        if (typeof url === 'string') {
            url = url.replace(/^(\\+|\/+)|(\\+|\/+)$/gmis, ''); // remove leading & trailing slashes
            url = url?.match(/pin\/+.+$/gmis)?.[0];
            if ((typeof url === 'string') && (url?.length > 0)) clean_urls.push(url);
        } else console.log(`Failed to clean url ${url}`);
    }

    return clean_urls;
}

function parse_srcset(srcset, best_quality = true) {
    console.log(`parse_srcset()`);
    if (typeof srcset === 'string') {
        srcset = srcset.split(',');
        if (best_quality === true) {
            srcset = srcset.sort((a, b) => {
                a = +(a?.match(/\d+?x+$/gmis)?.[0]?.match(/\d+/gmis)?.[0] || 1); // 1x
                b = +(b?.match(/\d+?x+$/gmis)?.[0]?.match(/\d+/gmis)?.[0] || 1); // 2x;
                return (b - a);
            });
        }

        srcset = srcset.map(e => (e.replace(/\d+?x+$/gmis, '')).trim());
        console.log({ sorted: srcset, best_quality });
        return srcset;
    } else {
        console.log('srcset is invalid. Expected a string');
        return null;
    }
}

async function download_pins(urls) {
    console.log(`download_pins()`);
    let failed_downloads = 0;
    let successful_downloads = 0;
    let i = 0;

    pin_urls_loop: for (const url of urls) {
        try {
            if (cancel_downloads === true) break pin_urls_loop;

            // Fetch the resource
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`Failed to fetch resource: ${url}`);
            }

            // Convert response to Blob
            const blob = await response.blob();

            // Create a download link
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);

            // Set the file name from the URL or a default name
            const fileName = url.split('/').pop() || 'downloaded_file';
            link.download = fileName;

            // Trigger the download
            document.body.appendChild(link); // Required for Firefox
            link.click();

            // Clean up the link
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);

            console.log(`Downloaded: ${fileName}`);
            successful_downloads++;
        } catch (error) {
            console.error(`Error downloading resource from ${url}:`, error);
            failed_downloads++;
        } finally {
            i++;
            DOM.full_ui_wrapper.progress_log_elem.self.classList.remove(...progress_logs);
            DOM.full_ui_wrapper.progress_log_elem.self.classList.add('cc_log');
            DOM.full_ui_wrapper.progress_log_elem.self.innerHTML = `${message_template.download_progress}, ${((i / urls?.length) * 100).toFixed(2)}%`;
        }
    }

    if (failed_downloads >= successful_downloads) throw false;
    else return ({ failed_downloads, successful_downloads });
}

function get_board_pin_count() {
    console.log(`get_board_pin_count()`);
    let pin_count_element = document.querySelector('[data-test-id="pin-count"]');
    let pin_count = +((document.body.innerText?.match(/\d+\s*pin[s]*/gmis)?.[0]?.match(/\d+/gmis)?.[0]) || (pin_count_element?.innerText?.match(/\d+\s*pin[s]*/gmis)?.[0]?.match(/\d+/gmis)?.[0])) || undefined;
    let formatted_pin_count = '';

    if (pin_count >= 0) {
        let formatted_pin_count = '';
        if (pin_count >= 1000) formatted_pin_count = `${(pin_count / 1_000).toFixed(2)}k`;
        else if (pin_count >= 1_000_000) formatted_pin_count = `${(pin_count / 1_000_000).toFixed(2)}M`;
        else if (pin_count >= 1_000_000_000) formatted_pin_count = `${(pin_count / 1_000_000_000).toFixed(2)}B`;
        else formatted_pin_count = `${pin_count}`;
        console.log('Successfully extracted the board pin count', { pin_count, formatted_pin_count });
        return ({ pin_count, formatted_pin_count });
    } else {
        console.log(`Failed to extract board pin count`, { pin_count });
        return null;
    }
}

function html_to_element(htmlString) {
    console.log(`html_to_element()`);
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html'); // Parse the HTML string
    return doc.body.firstChild; // Return the first child element from the parsed HTML
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

    // Remove hover and click functionality
    document.removeEventListener('contextmenu', handle_click);
    document.removeEventListener('scroll', remark_selected_pins);
    document.removeEventListener('drop', remark_selected_pins);
    window.removeEventListener('resize', remark_selected_pins);

    // Shutdown observer
    observer?.disconnect();
    observer = null;
    observer_running = false;

    // Unselect all pins
    let pins = Array.from(selected_pins.keys() || []);
    unselect_pins(pins);

    // remove overlays
    let matches = Array.from(document.querySelectorAll('[data-selected-overlay]') || []).forEach(e => e?.remove());

    // Clear the set of selected pins
    if (selected_pins.size > 0) selected_pins?.clear();

    // Remove the overlay and full ui
    DOM.full_ui_wrapper.self.remove();

    // Show the downloader button
    DOM.downloader_button.self.classList.remove('cc_hidden');
    DOM.downloader_button.self.classList.add('cc_visible');

    // Reset DOM references but keep the downloadBtn as is
    let downloader_button = DOM.downloader_button.self;
    DOM = DOM_template;
    DOM.downloader_button.self = downloader_button;

    console.log(`Full UI was successfully closed`);
    return;
}