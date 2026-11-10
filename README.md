### NodeCRM

原有 CRM 管理后台（Express + Angular）。安装与启动见下方。

## install

1:先导入数据库sql文件，更改数据库账号，在.config配置文件中修改

2:安装后端nodejs需要的包
```shell
npm install --registry=http://registry.npm.taobao.org
```
3:安装前端需要的js类库
```shell
bower install
```

4:启动服务
```shell
npm start 
```

---

## 测网速（独立工具）

本仓库另含独立应用 **「测网速」**，用于国内/国际连通测速与 DNS/网关修复辅助，**不依赖** 上方 CRM。

```bash
cd speedtest
npm install
npm start
```

打开 http://127.0.0.1:4177  

完整说明、修复脚本与限制见 [`speedtest/README.md`](speedtest/README.md)。
