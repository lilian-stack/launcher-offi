const { app } = require('electron')
const path = require('path')
const fs = require('fs')

const metrics = {}

function metricsPath() {
  try {
    const userData = app && app.getPath ? app.getPath('userData') : process.cwd()
    return path.join(userData || process.cwd(), 'startup-metrics.json')
  } catch (e) {
    return path.join(process.cwd(), 'startup-metrics.json')
  }
}

function write() {
  try {
    fs.writeFileSync(metricsPath(), JSON.stringify(metrics, null, 2))
  } catch (e) {
    // silent
  }
}

module.exports = {
  record(name) {
    try {
      metrics[name] = Date.now()
      write()
    } catch (e) {}
  },
  getMetrics() {
    return metrics
  },
  metricsPath
}
