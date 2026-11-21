# -*- coding: utf-8 -*-
"""部署配置加载器。

真实配置放在 `config.local.py`（不入库，含团队名单、花名映射、数据源链接与主机名）。
仓库只提交 `config.example.py`：没有本地配置时按示例运行，并在导入阶段给出明确提示。
"""
import importlib.util
import os
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
LOCAL_PATH = os.path.join(ROOT, "config.local.py")
EXAMPLE_PATH = os.path.join(ROOT, "config.example.py")


def _load(path, name):
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise SystemExit("无法加载配置文件：%s" % path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


IS_EXAMPLE = not os.path.exists(LOCAL_PATH)
cfg = _load(EXAMPLE_PATH if IS_EXAMPLE else LOCAL_PATH, "dashboard_config")

if IS_EXAMPLE:
    print(
        "提示：当前使用 config.example.py 的示例配置。\n"
        "      复制 config.example.py 为 config.local.py，填入真实团队、花名册文件名、\n"
        "      Google 数据源链接与主机名后再运行。",
        file=sys.stderr,
    )
