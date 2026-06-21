import gradio as gr
from modules import script_callbacks


def on_ui_tabs():
    return [(gr.Blocks(analytics_enabled=False), 'ModernUI', 'sdnext_uiux_core')]


script_callbacks.on_ui_tabs(on_ui_tabs)
