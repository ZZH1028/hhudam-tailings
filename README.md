# 尾矿库安全管理平台 · 工程分析扩展

该项目保留原站 `hhudam.vip.cpolar.cn` 的前端、账号和业务接口。入口转发原站网页和业务请求，原页面登录后加载一项「工程分析」菜单。新增工作台从菜单打开，可回到原来的页面位置。

## 打开和导入

1. 访问已部署地址，用原平台账号登录。
2. 管理员在左栏点击「工程分析」。普通用户从原「功能菜单」进入模型和资料工作区。
3. 在三维场景导入 GLB 或填写 3D Tiles、GLB、glTF 的 HTTPS 文件直链，再切换视角。局部模型需要正确的 WGS84 原点。
4. 在溃坝淹没导入经过转换的 OpenFOAM 水深 JSON 或规则 CSV，播放并按点位查询水深。格式示例和原始算例转换工具在工作台的「使用说明」。
5. 在专业知识导入 PDF、TXT 或 Markdown，按词检索并查看引用。勾选原站 AI 后，问答调用原站模型服务并传送匹配片段。

导入的资料和模型保存在当前浏览器。示例水深用于功能演示。真实工程结果由使用者导入。原站在线时，监测、精准预报、预案、用户管理及原 AI 助手等业务仍调用原来的服务。

## GitHub Pages

本仓库由 GitHub Actions 在 `main` 更新后发布，发布入口见仓库的 Settings → Pages。

- 首页默认展示原站页面。用右下角「工程分析」打开本仓库的三维、淹没和知识功能。若原站无法在框内打开，可用「更多 → 直达原平台」。
- 原站页面在原域名内运行，原登录、监测、精准预报、预案、用户管理和既有 AI 依赖原站在线。
- 公开工作台自带坝体与地形示例、理想矩形河槽过程、工程导读及数据格式示例。原站实景缓存、手册索引及原始资料可在私密完整版查看。
- 导入文件保存在本浏览器。使用原站 AI 需要原接口在线且允许跨域访问。没有模型响应时仍提供检索片段和引用。

Node.js 24 与 Python 3 环境下构建 GitHub Pages：

```bash
npm --prefix frontend ci
npm run build:pages
```

部署目录为 `dist/client`。另一种部署方式是运行 `npm run build`，在 Worker 环境发布 `dist/server/index.js` 及 `dist/client`。Worker 入口包含原站接口转发和原菜单集成，所需绑定见 `wrangler.jsonc`。

若要在受限的 Worker 部署中加载原站实景缓存和手册索引，先解压已获授权的 `Tailings_Platform_Main.zip`，再运行 `python scripts/prepare_private_assets.py /path/to/Tailings_Platform_Main`。请仅在有相应访问权限的环境构建并部署这些资料。

## OpenFOAM 转换

```bash
python -m pip install -r converter/requirements.txt
python converter/openfoam_import.py results.zip depth.json --lon <经度> --lat <纬度> --height <原点高程>
```

请用实际工程坐标替换参数。并行算例需先重构，多时刻 VTK 需包括 PVD 时间索引。含 `alpha.water` 的三维 VOF 数据转换为等效水柱深度。已有 `h` 或 `depth` 时优先采用明确水深字段。
