import { App, Plugin, TFile } from "obsidian";
import { DailyStatisticsSettings } from "./Settting";
import dayjs from "dayjs";

export interface WordCount {
  initial: number;
  current: number;
}

/**
 * 统计数据
 */
export class DailyStatisticsData {
  dayCounts: Record<string, number> = {};
  todayWordCount: Record<string, WordCount> = {};
  // 每周计划
  weeklyPlan: Record<string, number> = {};
  // 当日手动修改的字数
  currentManuallyModifyWordCount: number = 0;
}

export class DailyStatisticsDataManager {
  filePath = "";
  file!: TFile | null;
  today!: string;
  currentWordCount!: number;
  dataSaveListeners: DailyStatisticsDataSaveListener[] = [];
  dataSyncListeners: DailyStatisticsDataSyncListener[] = [];
  app!: App;
  data: DailyStatisticsData;
  plugin!: Plugin;

  loadingData = false;


  /**
   * 数据同步时间(ms) 
   * 这个变量的作用是为了处理多端数据同步时的冲突。
   * 每次更新数据文件时，更新这个时间。
   * 定时检查数据文件的修改时间，如果与系统中记录的时间不一致，则说明文件被外部程序修改了，则重新从文件中加载数据。
   */
  dataSynchronTime: number = 0;

  constructor() {
    // 给一个默认值，避免出错
    this.data = new DailyStatisticsData();
  }

  init(dataFile: string, app: App, plugin: Plugin) {
    this.filePath = dataFile;
    this.app = app;
    this.plugin = plugin;
  }


  /**
   * 加载数据
   */
  async loadStatisticsData() {
    this.loadingData = false;
    //    console.log("loadStatisticsData, filePath is " + this.filePath);

    // 如果配置文件为空，则从默认的设置中加载杜
    if (this.filePath == null || this.filePath == "") {
      this.data = Object.assign(
        new DailyStatisticsData(),
        await this.plugin.loadData()
      );
      // 移除配置相关的属性
      this.removeProperties(this.data, new DailyStatisticsSettings());
    } else {
      // 循环5次
      for (let i = 0; i < 10; i++) {
        this.file = this.app.vault.getFileByPath(this.filePath);
        if (this.file != null) {
          // console.log("dataFile ready");
          break;
        }
        // console.log("waiting for dataFile…… ");
        // 等待3秒
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      this.file = this.app.vault.getFileByPath(this.filePath);
      if (this.file == null) {
        console.log("create dataFile " + this.filePath);
        this.file = await this.app.vault.create(
          this.filePath,
          JSON.stringify(new DailyStatisticsData())
        );
      }
      this.data = Object.assign(
        new DailyStatisticsData(),
        await JSON.parse(await this.app.vault.read(this.file))
      );
      // console.log("loadStatisticsData, data is " + JSON.stringify(this.data));
    }

    this.updateDate();
    if (Object.prototype.hasOwnProperty.call(this.data.dayCounts, this.today)) {
      this.updateCounts();
    } else {
      // 如果记录中，没有当前日期的记录，则说明是新的一天，更新每日字数，和初始化记录
      this.data.todayWordCount = {};
      this.currentWordCount = 0;
      this.data.currentManuallyModifyWordCount = 0;
    }
    this.afterDataSync();

    this.dataSynchronTime = Date.now();
    this.loadingData = true;
  }

  // 获取当前数据文件的更新时间
  async getFileModifiedTime(): Promise<number> {
    if (this.file == null) {
      // 如果文件为空，则说明使用的插件的默认数据配置，这种情况下，不能进行同步，也不需要进行比较，所以返回 0
      return 0;
    }
    const stats = await this.app.vault.adapter.stat(this.file.path);
    return stats?.mtime ?? 0;
  }




  removeProperties(
    obj: Record<string, any>,
    propsToRemove: Record<string, any>
  ): void {
    // 获取要删除属性的名称数组
    const keysToRemove = Object.keys(propsToRemove);

    // 遍历要删除的属性名称，并从原始对象中删除它们
    keysToRemove.forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        delete obj[key];
      }
    });
  }

  addDataSaveListener(listener: DailyStatisticsDataSaveListener) {
    this.dataSaveListeners.push(listener);
  }

  addDataSyncListener(listener: DailyStatisticsDataSyncListener) {
    this.dataSyncListeners.push(listener);
  }


  // 移除数据监听器
  removeDataSaveListener(listener: DailyStatisticsDataSaveListener) {
    this.dataSaveListeners = this.dataSaveListeners.filter(
      (item) => item.getListenerId() !== listener.getListenerId()
    );
  }

  removeDataSyncListener(listener: DailyStatisticsDataSyncListener) {
    this.dataSyncListeners = this.dataSyncListeners.filter(
      (item) => item.getListenerId() !== listener.getListenerId()
    );
  }

  // 保存数据
  async saveStatisticsData() {
    try {
      if (!this.loadingData) {
        return;
      }
      this.updateDate();
      if (this.filePath != null && this.filePath != "") {
        if (this.file == null) {
          this.file = await this.app.vault.create(
            this.filePath,
            JSON.stringify(this.data)
          );
        }
        // console.log("saveStatisticsData, data is " + JSON.stringify(this.data));
        await this.app.vault.modify(this.file, JSON.stringify(this.data));
      } else {
        let data = await this.plugin.loadData();
        // // // console.log("saveStatisticsData, data is " + JSON.stringify(data));
        if (data == null) {
          data = {};
        }
        Object.assign(data, this.data);
        await this.plugin.saveData(data);
      }
      this.dataSynchronTime = Date.now();

      // 异步执行监听器，数据保存之后的回调
      this.afterDataSave();
    } catch (error) {
      console.error("保存统计数据出错：", error);
    }
  }



  /**
  * 异步执行监听器，数据保存之后的回调
  */
  afterDataSave() {
    new Promise(() => {
      for (const listener of this.dataSaveListeners) {
        try {
          listener.onSave(this.data);
          // // // console.log("dataSaveListener 执行完成, listenerId is " + listener.getListenerId());
        } catch (error) {
          console.error(
            "dataSaveListeners, 执行异常, listenerId is " +
            listener.getListenerId(),
            error
          );
        }
      }
    });
  }

  /**
   * 异步执行监听器，数据同步之后的回调
   */
  afterDataSync() {
    new Promise(() => {
      for (const listener of this.dataSyncListeners) {
        try {
          listener.onSync(this.data);
        } catch (error) {
          console.error("dataSyncListeners, 执行异常, listenerId is " + listener.getListenerId(), error);
        }
      }
    });
  }

  /**
   * 统计字数
   * @param text
   */
  getWordCount(text: string) {
    if (this.plugin.settings.statisticsWord) {
      return this.countTheNumberOfWords(text);
    }
    // 直接统计字数数量
    return text.length;
  }

  /**
   * 统计单词数
   * @param text
   * @private
   */
  private countTheNumberOfWords(text: string) {
    const spaceDelimitedChars =
      /'’A-Za-z\u00AA\u00B5\u00BA\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02C1\u02C6-\u02D1\u02E0-\u02E4\u02EC\u02EE\u0370-\u0374\u0376\u0377\u037A-\u037D\u037F\u0386\u0388-\u038A\u038C\u038E-\u03A1\u03A3-\u03F5\u03F7-\u0481\u048A-\u052F\u0531-\u0556\u0559\u0561-\u0587\u05D0-\u05EA\u05F0-\u05F2\u0620-\u064A\u066E\u066F\u0671-\u06D3\u06D5\u06E5\u06E6\u06EE\u06EF\u06FA-\u06FC\u06FF\u0710\u0712-\u072F\u074D-\u07A5\u07B1\u07CA-\u07EA\u07F4\u07F5\u07FA\u0800-\u0815\u081A\u0824\u0828\u0840-\u0858\u08A0-\u08B4\u0904-\u0939\u093D\u0950\u0958-\u0961\u0971-\u0980\u0985-\u098C\u098F\u0990\u0993-\u09A8\u09AA-\u09B0\u09B2\u09B6-\u09B9\u09BD\u09CE\u09DC\u09DD\u09DF-\u09E1\u09F0\u09F1\u0A05-\u0A0A\u0A0F\u0A10\u0A13-\u0A28\u0A2A-\u0A30\u0A32\u0A33\u0A35\u0A36\u0A38\u0A39\u0A59-\u0A5C\u0A5E\u0A72-\u0A74\u0A85-\u0A8D\u0A8F-\u0A91\u0A93-\u0AA8\u0AAA-\u0AB0\u0AB2\u0AB3\u0AB5-\u0AB9\u0ABD\u0AD0\u0AE0\u0AE1\u0AF9\u0B05-\u0B0C\u0B0F\u0B10\u0B13-\u0B28\u0B2A-\u0B30\u0B32\u0B33\u0B35-\u0B39\u0B3D\u0B5C\u0B5D\u0B5F-\u0B61\u0B71\u0B83\u0B85-\u0B8A\u0B8E-\u0B90\u0B92-\u0B95\u0B99\u0B9A\u0B9C\u0B9E\u0B9F\u0BA3\u0BA4\u0BA8-\u0BAA\u0BAE-\u0BB9\u0BD0\u0C05-\u0C0C\u0C0E-\u0C10\u0C12-\u0C28\u0C2A-\u0C39\u0C3D\u0C58-\u0C5A\u0C60\u0C61\u0C85-\u0C8C\u0C8E-\u0C90\u0C92-\u0CA8\u0CAA-\u0CB3\u0CB5-\u0CB9\u0CBD\u0CDE\u0CE0\u0CE1\u0CF1\u0CF2\u0D05-\u0D0C\u0D0E-\u0D10\u0D12-\u0D3A\u0D3D\u0D4E\u0D5F-\u0D61\u0D7A-\u0D7F\u0D85-\u0D96\u0D9A-\u0DB1\u0DB3-\u0DBB\u0DBD\u0DC0-\u0DC6\u0E01-\u0E30\u0E32\u0E33\u0E40-\u0E46\u0E81\u0E82\u0E84\u0E87\u0E88\u0E8A\u0E8D\u0E94-\u0E97\u0E99-\u0E9F\u0EA1-\u0EA3\u0EA5\u0EA7\u0EAA\u0EAB\u0EAD-\u0EB0\u0EB2\u0EB3\u0EBD\u0EC0-\u0EC4\u0EC6\u0EDC-\u0EDF\u0F00\u0F40-\u0F47\u0F49-\u0F6C\u0F88-\u0F8C\u1000-\u102A\u103F\u1050-\u1055\u105A-\u105D\u1061\u1065\u1066\u106E-\u1070\u1075-\u1081\u108E\u10A0-\u10C5\u10C7\u10CD\u10D0-\u10FA\u10FC-\u1248\u124A-\u124D\u1250-\u1256\u1258\u125A-\u125D\u1260-\u1288\u128A-\u128D\u1290-\u12B0\u12B2-\u12B5\u12B8-\u12BE\u12C0\u12C2-\u12C5\u12C8-\u12D6\u12D8-\u1310\u1312-\u1315\u1318-\u135A\u1380-\u138F\u13A0-\u13F5\u13F8-\u13FD\u1401-\u166C\u166F-\u167F\u1681-\u169A\u16A0-\u16EA\u16F1-\u16F8\u1700-\u170C\u170E-\u1711\u1720-\u1731\u1740-\u1751\u1760-\u176C\u176E-\u1770\u1780-\u17B3\u17D7\u17DC\u1820-\u1877\u1880-\u18A8\u18AA\u18B0-\u18F5\u1900-\u191E\u1950-\u196D\u1970-\u1974\u1980-\u19AB\u19B0-\u19C9\u1A00-\u1A16\u1A20-\u1A54\u1AA7\u1B05-\u1B33\u1B45-\u1B4B\u1B83-\u1BA0\u1BAE\u1BAF\u1BBA-\u1BE5\u1C00-\u1C23\u1C4D-\u1C4F\u1C5A-\u1C7D\u1CE9-\u1CEC\u1CEE-\u1CF1\u1CF5\u1CF6\u1D00-\u1DBF\u1E00-\u1F15\u1F18-\u1F1D\u1F20-\u1F45\u1F48-\u1F4D\u1F50-\u1F57\u1F59\u1F5B\u1F5D\u1F5F-\u1F7D\u1F80-\u1FB4\u1FB6-\u1FBC\u1FBE\u1FC2-\u1FC4\u1FC6-\u1FCC\u1FD0-\u1FD3\u1FD6-\u1FDB\u1FE0-\u1FEC\u1FF2-\u1FF4\u1FF6-\u1FFC\u2071\u207F\u2090-\u209C\u2102\u2107\u210A-\u2113\u2115\u2119-\u211D\u2124\u2126\u2128\u212A-\u212D\u212F-\u2139\u213C-\u213F\u2145-\u2149\u214E\u2183\u2184\u2C00-\u2C2E\u2C30-\u2C5E\u2C60-\u2CE4\u2CEB-\u2CEE\u2CF2\u2CF3\u2D00-\u2D25\u2D27\u2D2D\u2D30-\u2D67\u2D6F\u2D80-\u2D96\u2DA0-\u2DA6\u2DA8-\u2DAE\u2DB0-\u2DB6\u2DB8-\u2DBE\u2DC0-\u2DC6\u2DC8-\u2DCE\u2DD0-\u2DD6\u2DD8-\u2DDE\u2E2F\u3005\u3006\u3031-\u3035\u303B\u303C\u3105-\u312D\u3131-\u318E\u31A0-\u31BA\u31F0-\u31FF\u3400-\u4DB5\uA000-\uA48C\uA4D0-\uA4FD\uA500-\uA60C\uA610-\uA61F\uA62A\uA62B\uA640-\uA66E\uA67F-\uA69D\uA6A0-\uA6E5\uA717-\uA71F\uA722-\uA788\uA78B-\uA7AD\uA7B0-\uA7B7\uA7F7-\uA801\uA803-\uA805\uA807-\uA80A\uA80C-\uA822\uA840-\uA873\uA882-\uA8B3\uA8F2-\uA8F7\uA8FB\uA8FD\uA90A-\uA925\uA930-\uA946\uA960-\uA97C\uA984-\uA9B2\uA9CF\uA9E0-\uA9E4\uA9E6-\uA9EF\uA9FA-\uA9FE\uAA00-\uAA28\uAA40-\uAA42\uAA44-\uAA4B\uAA60-\uAA76\uAA7A\uAA7E-\uAAAF\uAAB1\uAAB5\uAAB6\uAAB9-\uAABD\uAAC0\uAAC2\uAADB-\uAADD\uAAE0-\uAAEA\uAAF2-\uAAF4\uAB01-\uAB06\uAB09-\uAB0E\uAB11-\uAB16\uAB20-\uAB26\uAB28-\uAB2E\uAB30-\uAB5A\uAB5C-\uAB65\uAB70-\uABE2\uAC00-\uD7A3\uD7B0-\uD7C6\uD7CB-\uD7FB\uF900-\uFA6D\uFA70-\uFAD9\uFB00-\uFB06\uFB13-\uFB17\uFB1D\uFB1F-\uFB28\uFB2A-\uFB36\uFB38-\uFB3C\uFB3E\uFB40\uFB41\uFB43\uFB44\uFB46-\uFBB1\uFBD3-\uFD3D\uFD50-\uFD8F\uFD92-\uFDC7\uFDF0-\uFDFB\uFE70-\uFE74\uFE76-\uFEFC\uFF21-\uFF3A\uFF41-\uFF5A\uFF66-\uFFBE\uFFC2-\uFFC7\uFFCA-\uFFCF\uFFD2-\uFFD7\uFFDA-\uFFDC/
        .source;
    const nonSpaceDelimitedWords =
      /\u3041-\u3096\u309D-\u309F\u30A1-\u30FA\u30FC-\u30FF\u4E00-\u9FD5/
        .source;

    const nonSpaceDelimitedWordsOther =
      /[\u3041-\u3096\u309D-\u309F\u30A1-\u30FA\u30FC-\u30FF\u4E00-\u9FD5]{1}/
        .source;

    const pattern = new RegExp(
      [
        `(?:[0-9]+(?:(?:,|\\.)[0-9]+)*|[\\-${spaceDelimitedChars}])+`,
        nonSpaceDelimitedWords,
        nonSpaceDelimitedWordsOther,
      ].join("|"),
      "g"
    );
    return (text.match(pattern) || []).length;
  }

  async updateWordCount(contents: string, filepath: string) {
    if (contents == null || contents.length == 0) {
      const tempFile = this.app.vault.getFileByPath(filepath);
      contents = await this.app.vault.read(tempFile);
    }
    const curr = this.getWordCount(contents);
    // console.log("updateWordCount", curr);
    if (Object.prototype.hasOwnProperty.call(this.data.dayCounts, this.today)) {
      if (
        Object.prototype.hasOwnProperty.call(this.data.todayWordCount, filepath)
      ) {
        // 当前文件已有记录，则更新当前字数
        this.data.todayWordCount[filepath].current = curr;
      } else {
        // 当前文件没有记录，新增记录
        this.data.todayWordCount[filepath] = { initial: curr, current: curr };
      }
    } else {
      // 新的一天，清空当天的记录
      this.data.todayWordCount = {};
      this.data.todayWordCount[filepath] = { initial: curr, current: curr };
    }
    this.updateCounts();
  }

  updateDate() {
    this.today = dayjs().format("YYYY-MM-DD");
  }

  updateCounts() {
    this.currentWordCount = Object.values(this.data.todayWordCount)
      .map((wordCount) => Math.max(0, wordCount.current - wordCount.initial))
      .reduce((a, b) => a + b, 0);
    this.currentWordCount += this.data.currentManuallyModifyWordCount;
    this.data.dayCounts[this.today] = this.currentWordCount;

    this.saveStatisticsData().then();
  }

  updateCurrentWordCount(wordCount: number) {
    // 先减去旧的手动值，得到真实值
    const actualValue =
      this.currentWordCount - this.data.currentManuallyModifyWordCount;
    // 然后再根据真实值，计算新的手动值
    this.data.currentManuallyModifyWordCount = wordCount - actualValue;
    this.currentWordCount = wordCount;
  }

  /**
   * 重置当日统计数据
   */
  resetCurrentDayStatistics() {
    this.data.todayWordCount = {};
    this.updateCounts();
  }
}

/**
 * 保存数据监听
 */
export interface DailyStatisticsDataSaveListener {
  onSave(data: DailyStatisticsData): void;

  getListenerId(): string;
}

/**
 * 数据同步监听
 */
export interface DailyStatisticsDataSyncListener {
  onSync(data: DailyStatisticsData): void;
  getListenerId(): string;
}



export const DailyStatisticsDataManagerInstance: DailyStatisticsDataManager =
  new DailyStatisticsDataManager();
