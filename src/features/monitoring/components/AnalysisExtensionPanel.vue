<template>
  <section class="analysis-panel">
    <header>
      <div>
        <h3>智能识别扩展</h3>
        <p>原始数据与识别逻辑分离，后续按处理器接入。</p>
      </div>
      <span>接口已预留</span>
    </header>
    <div class="analysis-panel__slots">
      <article>
        <span class="analysis-panel__glyph">S</span>
        <div>
          <strong>传感器处理器</strong>
          <p>设备状态、事件规则、趋势分析</p>
        </div>
        <small>未配置</small>
      </article>
      <article>
        <span class="analysis-panel__glyph analysis-panel__glyph--video">V</span>
        <div>
          <strong>视频帧处理器</strong>
          <p>跌倒、离床、区域事件等识别任务</p>
        </div>
        <small>未配置</small>
      </article>
    </div>
  </section>
</template>

<style scoped lang="scss">
.analysis-panel {
  padding-top: 17px;
  margin-top: 18px;
  border-top: 1px solid #e4ebe8;

  > header {
    display: flex;
    gap: 12px;
    align-items: flex-start;
    justify-content: space-between;

    h3 {
      margin: 0;
      font-size: 13px;
      font-weight: 650;
    }

    p,
    > span {
      margin: 3px 0 0;
      font-size: 10px;
      color: #83928e;
    }
  }
}

.analysis-panel__slots {
  display: grid;
  gap: 7px;
  margin-top: 12px;

  article {
    display: grid;
    grid-template-columns: 30px minmax(0, 1fr) auto;
    gap: 10px;
    align-items: center;
    padding: 10px;
    background: #fafcfb;
    border: 1px solid #e1e9e6;
  }

  div {
    display: grid;
    gap: 3px;
  }

  strong {
    font-size: 11px;
    font-weight: 600;
  }

  p,
  small {
    margin: 0;
    font-size: 9px;
    color: #83928e;
  }
}

.analysis-panel__glyph {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  font-family: "Avenir Next", sans-serif;
  font-size: 10px;
  font-weight: 700;
  color: #2c715f;
  background: #eef6f3;
  border: 1px solid #bed8d0;
  border-radius: 3px;
}

.analysis-panel__glyph--video {
  color: #3e6877;
  background: #f1f6f8;
  border-color: #c8d7df;
}
</style>
