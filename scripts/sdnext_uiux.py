# Originally from Anapnoe@https://github.com/anapnoe/stable-diffusion-webui-ux/blob/8307896c59032a9cdac1ab24c975102ff9a674d3/extensions-builtin/anapnoe-sd-uiux/scripts/anapnoe_sd_uiux.py

import gradio as gr
from modules import script_callbacks, shared

def on_ui_settings():
    shared.options_templates.update(shared.options_section(('uiux_core', "UI-UX"), {
        "uiux_enable_console_log": shared.OptionInfo(True, "Enable debug log"),

        "uiux_max_resolution_output": shared.OptionInfo(2048, "Max resolution output for txt2img and img2img"),
        "uiux_show_input_range_ticks": shared.OptionInfo(True, "Show ticks for input range slider"),
        "uiux_show_outline_params": shared.OptionInfo(True, "Show parameter outline"),
        "uiux_no_slider_layout": shared.OptionInfo(False, "No input range sliders"),
        "uiux_disable_transitions": shared.OptionInfo(False, "Disable transitions"),

        "uiux_show_labels_aside": shared.OptionInfo(False, "Show labels for aside tabs"),
        "uiux_show_labels_main": shared.OptionInfo(False, "Show labels for main tabs"),
        "uiux_show_labels_tabs": shared.OptionInfo(False, "Show labels for page tabs"),
        "uiux_show_labels_control": shared.OptionInfo(False, "Show labels for control tabs"),

        "uiux_default_layout": shared.OptionInfo("Auto", "Layout", gr.Radio, {"choices": ["Auto","Desktop", "Mobile"]}),  
        "uiux_mobile_scale": shared.OptionInfo(0.7, "Mobile scale", gr.Slider, {"minimum": 0.5, "maximum": 1, "step": 0.05})
    }))

script_callbacks.on_ui_settings(on_ui_settings)


def on_ui_tabs():   
    return (gr.Blocks(analytics_enabled=False), 'UI-UX Core', 'sdnext_uiux_core'),

script_callbacks.on_ui_tabs(on_ui_tabs)