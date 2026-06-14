(function () {
  const manifestUrl = "assets/blog-materials/manifest.json";
  window.ROSE_BLOG_MATERIALS_READY = fetch(manifestUrl)
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .then((manifest) => {
      window.ROSE_BLOG_MATERIALS = manifest;
      window.dispatchEvent(new CustomEvent("rose-blog-materials-ready", { detail: manifest }));
      return manifest;
    })
    .catch((error) => {
      console.warn("[BlogMaterials] manifest 加载失败，继续使用内置素材。", error);
      window.ROSE_BLOG_MATERIALS = null;
      return null;
    });
})();
