module.exports = [
  {
    name: "html artifact for teaching animation",
    prompt: "帮我做一个勾股定理的演示动画，html代码形式，给初中生看",
    expected: {
      namespace: "artifact.html.generate",
      mode: "coding",
      modality: "html",
      routeTarget: "agent",
      runtime: "agent-runtime",
      modelRequired: true
    }
  },
  {
    name: "external reference to html artifact",
    prompt: "参考这个小游戏的风格https://messenger.abeto.co/，做一个孔乙己所在家乡鲁镇的游览，主角孔乙己",
    expected: {
      namespace: "artifact.html.generate",
      mode: "coding",
      modality: "html",
      routeTarget: "agent",
      runtime: "agent-runtime",
      requiresExternalContext: true,
      requiredToolCapabilities: ["workspace", "web"]
    }
  },
  {
    name: "explicit coding mode",
    prompt: "切换进入编码模式",
    expected: {
      namespace: "coding.file_edit",
      mode: "coding",
      modality: "text",
      routeTarget: "agent",
      runtime: "agent-runtime"
    }
  },
  {
    name: "script generation should be coding even with video word",
    prompt: "帮我写一个脚本生成视频",
    expected: {
      namespace: "coding.file_edit",
      mode: "coding",
      modality: "text",
      routeTarget: "agent"
    }
  },
  {
    name: "video generation uses video model capability",
    prompt: "帮我生成一个咖啡广告视频",
    expected: {
      namespace: "media.video.generate",
      mode: "chat",
      modality: "video",
      modelCapability: "videoGeneration",
      routeTarget: "model",
      runtime: "model"
    }
  },
  {
    name: "image generation uses image model capability",
    prompt: "帮我画一张美式咖啡图片",
    expected: {
      namespace: "media.image.generate",
      mode: "chat",
      modality: "image",
      modelCapability: "imageGeneration",
      routeTarget: "model",
      runtime: "model"
    }
  },
  {
    name: "vision qa requires image input",
    prompt: "这张图片里有什么？",
    attachments: [{ name: "cat.png", type: "image/png" }],
    expected: {
      namespace: "vision.qa",
      mode: "chat",
      modality: "text",
      modelCapability: "imageInput",
      routeTarget: "model"
    }
  },
  {
    name: "url explanation is content task not model config",
    prompt: "https://hermes-agent.nousresearch.com/docs/developer-guide/provider-runtime\n\n解释一下",
    expected: {
      namespace: "content.explain.url",
      mode: "chat",
      modality: "text",
      modelCapability: "chat",
      requiresExternalContext: true
    }
  },
  {
    name: "pdf export is local-first tool route",
    prompt: "把以上所有内容导出为一个精美的格式的pdf文件",
    expected: {
      namespace: "artifact.pdf.export",
      mode: "coding",
      modality: "text",
      routeTarget: "tool",
      runtime: "local-tool",
      localFirst: true,
      modelRequired: false,
      requiredToolCapabilities: ["workspace", "pdf", "document"]
    }
  },
  {
    name: "base64 file transform is local-first tool route",
    prompt: "fiitx-logo.png 用base64形式",
    expected: {
      namespace: "file.transform.base64",
      mode: "coding",
      modality: "text",
      routeTarget: "tool",
      runtime: "local-tool",
      localFirst: true,
      modelRequired: false,
      requiredToolCapabilities: ["workspace", "file-transform"]
    }
  },
  {
    name: "base64 image embed into html is local html embed route",
    prompt: `<img src="
fiitx-logo.png
" alt="Fiitx" class="logo-img"> 要替换为png对应的base64形式，放到index.html`,
    expected: {
      namespace: "file.transform.base64",
      mode: "coding",
      modality: "text",
      routeTarget: "tool",
      runtime: "local-tool",
      localFirst: true,
      modelRequired: false,
      outputAction: "html.embed_data_uri",
      requiredToolCapabilities: ["workspace", "file-transform", "html-embed"]
    }
  },
  {
    name: "model profile config is system intent",
    prompt: "配置 OpenAI-compatible profile，base_url 是 https://api.example.com/v1",
    expected: {
      namespace: "system.model.configure",
      mode: "chat",
      modality: "text",
      isSystemIntent: true
    }
  }
];
