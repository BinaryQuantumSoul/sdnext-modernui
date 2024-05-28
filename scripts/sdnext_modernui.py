import gradio as gr
from modules import script_callbacks


def on_ui_settings():
    from modules.shared import OptionInfo, options_section , options_templates
    options_templates.update(options_section(('ui', "User Interface Options"), {
        'uiux_separator_appearance': OptionInfo("<h2>Appearance</h2>", "", gr.HTML),
        "uiux_hide_legacy": OptionInfo(True, "Hide txt2img and img2img tabs"),
        "uiux_persist_layout": OptionInfo(True, "Persist UI layout"),
        "uiux_no_slider_layout": OptionInfo(False, "Hide input range sliders"),
        "uiux_show_input_range_ticks": OptionInfo(True, "Show ticks for input range slider"),
        "uiux_show_labels_aside": OptionInfo(False, "Show labels for aside tabs"),
        "uiux_show_labels_main": OptionInfo(False, "Show labels for main tabs"),
        "uiux_show_labels_tabs": OptionInfo(False, "Show labels for page tabs"),
        "uiux_show_labels_control": OptionInfo(False, "Show labels for control tabs"),
        "uiux_no_headers_params": OptionInfo(False, "Hide params headers"),
        "uiux_show_outline_params": OptionInfo(True, "Show parameter outline"),

        'uiux_separator_mobile': OptionInfo("<h2>Mobile</h2>", "", gr.HTML),
        "uiux_default_layout": OptionInfo("Auto", "Layout", gr.Radio, {"choices": ["Auto","Desktop", "Mobile"]}),
        "uiux_mobile_scale": OptionInfo(0.7, "Mobile scale", gr.Slider, {"minimum": 0.5, "maximum": 1, "step": 0.05}),

        'uiux_separator_other': OptionInfo("<h2>Other Settings</h2>", "", gr.HTML),
        "uiux_enable_console_log": OptionInfo(False, "Enable debug log"),
        "uiux_max_resolution_output": OptionInfo(4096, "Max resolution output for txt2img and img2img"),
        "uiux_disable_transitions": OptionInfo(False, "Disable transitions")
    }))


def on_ui_tabs():
    return [(gr.Blocks(analytics_enabled=False), 'ModernUI', 'sdnext_uiux_core')]


script_callbacks.on_ui_settings(on_ui_settings)
script_callbacks.on_ui_tabs(on_ui_tabs)
