import { performance } from 'perf_hooks';

interface MemoryMetrics {
  heapUsed: number;
  heapTotal: number;
  external: number;
  arrayBuffers: number;
  rss: number;
  timestamp: number;
  uptime: number;
}

export class MemoryMonitor {
  private static instance: MemoryMonitor;
  private metricsHistory: MemoryMetrics[] = [];
  private readonly maxHistoryLength: number = 100; // Keep last 100 measurements
  private readonly warningThreshold: number = 0.8; // 80% of heap used
  private readonly criticalThreshold: number = 0.9; // 90% of heap used

  private constructor() {}

  public static getInstance(): MemoryMonitor {
    if (!MemoryMonitor.instance) {
      MemoryMonitor.instance = new MemoryMonitor();
    }
    return MemoryMonitor.instance;
  }

  public getCurrentMetrics(): MemoryMetrics {
    const memoryUsage = process.memoryUsage();
    return {
      heapUsed: memoryUsage.heapUsed,
      heapTotal: memoryUsage.heapTotal,
      external: memoryUsage.external,
      arrayBuffers: memoryUsage.arrayBuffers,
      rss: memoryUsage.rss,
      timestamp: Date.now(),
      uptime: process.uptime()
    };
  }

  public logMemoryUsage(): void {
    const metrics = this.getCurrentMetrics();
    this.metricsHistory.push(metrics);
    
    // Keep only the last N measurements
    if (this.metricsHistory.length > this.maxHistoryLength) {
      this.metricsHistory.shift();
    }

    const heapUsedPercentage = metrics.heapUsed / metrics.heapTotal;
    
    // Format memory values to MB for better readability
    const heapUsedMB = (metrics.heapUsed / 1024 / 1024).toFixed(2);
    const heapTotalMB = (metrics.heapTotal / 1024 / 1024).toFixed(2);
    const rssMB = (metrics.rss / 1024 / 1024).toFixed(2);

    console.log(`[Memory Monitor] Heap Used: ${heapUsedMB}MB / ${heapTotalMB}MB (${(heapUsedPercentage * 100).toFixed(2)}%)`);
    console.log(`[Memory Monitor] RSS: ${rssMB}MB`);
    
    if (heapUsedPercentage >= this.criticalThreshold) {
      console.error(`[Memory Monitor] CRITICAL: Memory usage is at ${(heapUsedPercentage * 100).toFixed(2)}%`);
    } else if (heapUsedPercentage >= this.warningThreshold) {
      console.warn(`[Memory Monitor] WARNING: Memory usage is at ${(heapUsedPercentage * 100).toFixed(2)}%`);
    }
  }

  public getMetricsHistory(): MemoryMetrics[] {
    return [...this.metricsHistory];
  }

  public getMemoryLeakIndicators(): { 
    isPotentialLeak: boolean; 
    details: string;
  } {
    if (this.metricsHistory.length < 2) {
      return { isPotentialLeak: false, details: 'Insufficient data for leak detection' };
    }

    const recentMetrics = this.metricsHistory.slice(-10); // Look at last 10 measurements
    const heapGrowth = recentMetrics.map(m => m.heapUsed);
    const isConsistentlyGrowing = heapGrowth.every((val, idx) => 
      idx === 0 || val > heapGrowth[idx - 1]
    );

    const growthRate = (heapGrowth[heapGrowth.length - 1] - heapGrowth[0]) / heapGrowth[0];
    
    return {
      isPotentialLeak: isConsistentlyGrowing && growthRate > 0.1, // 10% growth threshold
      details: isConsistentlyGrowing 
        ? `Memory consistently growing at rate of ${(growthRate * 100).toFixed(2)}%`
        : 'No consistent memory growth detected'
    };
  }
} 