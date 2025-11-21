// [file name]: server_modules/services/pdf-parser-enhanced.js
const fs = require('fs');
const pdfParse = require('pdf-parse');
const { PDFParser } = require('pdf2json');

class PDFParserEnhanced {
    constructor() {
        console.log('📄 增强PDF解析服务初始化');
    }

    // 使用多种方法解析PDF
    async extractTextFromPDF(pdfBuffer) {
        // 方法1: 使用pdf-parse
        console.log('尝试使用pdf-parse解析...');
        const result1 = await this.parseWithPDFParse(pdfBuffer);
        if (result1.success && result1.text && result1.text.trim().length > 100) {
            console.log('✅ pdf-parse解析成功');
            return result1;
        }

        // 方法2: 使用pdf2json
        console.log('pdf-parse失败，尝试使用pdf2json...');
        const result2 = await this.parseWithPDF2JSON(pdfBuffer);
        if (result2.success && result2.text && result2.text.trim().length > 100) {
            console.log('✅ pdf2json解析成功');
            return result2;
        }

        // 方法3: 使用原始文本提取
        console.log('前两种方法失败，尝试原始文本提取...');
        const result3 = await this.extractRawText(pdfBuffer);
        if (result3.success && result3.text && result3.text.trim().length > 50) {
            console.log('✅ 原始文本提取成功');
            return result3;
        }

        // 所有方法都失败
        console.log('❌ 所有PDF解析方法都失败');
        return {
            success: false,
            message: '无法提取PDF文本内容，可能是扫描版PDF或加密文件'
        };
    }

    // 方法1: 使用pdf-parse
    async parseWithPDFParse(pdfBuffer) {
        try {
            const data = await pdfParse(pdfBuffer);
            
            if (!data.text || data.text.trim().length === 0) {
                return {
                    success: false,
                    message: 'PDF文件为空或无法提取文本'
                };
            }

            return {
                success: true,
                text: data.text,
                pages: data.numpages,
                info: data.info,
                method: 'pdf-parse'
            };
            
        } catch (error) {
            return {
                success: false,
                message: 'pdf-parse解析失败: ' + error.message
            };
        }
    }

    // 方法2: 使用pdf2json
    async parseWithPDF2JSON(pdfBuffer) {
        return new Promise((resolve) => {
            try {
                const pdfParser = new PDFParser();
                
                pdfParser.on("pdfParser_dataError", errData => {
                    console.error('pdf2json解析错误:', errData.parserError);
                    resolve({
                        success: false,
                        message: 'pdf2json解析错误: ' + errData.parserError
                    });
                });
                
                pdfParser.on("pdfParser_dataReady", pdfData => {
                    try {
                        let text = '';
                        
                        // 提取文本内容
                        if (pdfData.formImage && pdfData.formImage.Pages) {
                            pdfData.formImage.Pages.forEach(page => {
                                if (page.Texts) {
                                    page.Texts.forEach(textObj => {
                                        if (textObj.R) {
                                            textObj.R.forEach(r => {
                                                if (r.T) {
                                                    // 解码Base64编码的文本
                                                    try {
                                                        text += decodeURIComponent(r.T) + ' ';
                                                    } catch (e) {
                                                        text += r.T + ' ';
                                                    }
                                                }
                                            });
                                        }
                                    });
                                }
                            });
                        }
                        
                        if (text.trim().length === 0) {
                            resolve({
                                success: false,
                                message: 'pdf2json未提取到文本'
                            });
                        } else {
                            resolve({
                                success: true,
                                text: text,
                                pages: pdfData.formImage.Pages ? pdfData.formImage.Pages.length : 0,
                                method: 'pdf2json'
                            });
                        }
                    } catch (error) {
                        resolve({
                            success: false,
                            message: 'pdf2json数据处理错误: ' + error.message
                        });
                    }
                });
                
                // 解析PDF
                pdfParser.parseBuffer(pdfBuffer);
                
            } catch (error) {
                resolve({
                    success: false,
                    message: 'pdf2json初始化失败: ' + error.message
                });
            }
        });
    }

    // 方法3: 原始文本提取（增强版）
    async extractRawText(pdfBuffer) {
        try {
            // 尝试多种编码方式提取文本
            const encodings = ['utf8', 'utf16le', 'latin1'];
            let bestText = '';
            
            for (const encoding of encodings) {
                try {
                    const text = pdfBuffer.toString(encoding);
                    if (text.length > bestText.length && this.looksLikeMeaningfulText(text)) {
                        bestText = text;
                    }
                } catch (e) {
                    // 忽略编码错误，尝试下一种
                }
            }
            
            // 如果主要方法都失败，尝试分段提取
            if (bestText.length < 100) {
                bestText = this.extractTextChunks(pdfBuffer);
            }
            
            if (bestText.trim().length === 0) {
                return {
                    success: false,
                    message: '原始文本提取未找到有效内容'
                };
            }
            
            return {
                success: true,
                text: this.cleanExtractedText(bestText),
                method: 'enhanced-raw-extraction'
            };
            
        } catch (error) {
            return {
                success: false,
                message: '原始文本提取失败: ' + error.message
            };
        }
    }

    // 清理提取的文本
    cleanExtractedText(text) {
        // 移除过多的空白字符
        let cleaned = text.replace(/\s+/g, ' ');
        
        // 尝试修复常见的编码问题
        cleaned = cleaned.replace(/Ã¡/g, 'á')
                        .replace(/Ã©/g, 'é')
                        .replace(/Ã³/g, 'ó')
                        .replace(/Ãº/g, 'ú')
                        .replace(/Ã±/g, 'ñ')
                        .replace(/Â°/g, '°');
        
        return cleaned.trim();
    }

    // 判断文本是否有意义
    looksLikeMeaningfulText(str) {
        if (!str || str.length < 10) return false;
        
        // 计算中英文字符的比例
        const chineseChars = str.match(/[\u4e00-\u9fff]/g) || [];
        const englishChars = str.match(/[a-zA-Z]/g) || [];
        const totalMeaningfulChars = chineseChars.length + englishChars.length;
        
        const ratio = totalMeaningfulChars / str.length;
        
        // 如果有意义字符比例超过30%，认为是有效文本
        return ratio > 0.3;
    }

    // 分块提取文本
    extractTextChunks(buffer) {
        let extractedText = '';
        const chunkSize = 1000;
        
        for (let i = 0; i < buffer.length; i += chunkSize) {
            const chunk = buffer.slice(i, i + chunkSize);
            
            // 尝试多种编码
            for (const encoding of ['utf8', 'latin1']) {
                try {
                    const chunkText = chunk.toString(encoding);
                    if (this.looksLikeMeaningfulText(chunkText)) {
                        extractedText += chunkText + ' ';
                        break;
                    }
                } catch (e) {
                    // 忽略错误
                }
            }
        }
        
        return extractedText;
    }

    // 判断字符串是否看起来像文本（保留原有方法，用于兼容性）
    looksLikeText(str) {
        if (!str || str.length < 5) return false;
        
        // 计算可打印字符的比例
        const printableChars = str.replace(/[^\x20-\x7E\u4E00-\u9FFF]/g, '').length;
        const ratio = printableChars / str.length;
        
        // 如果可打印字符比例超过60%，认为是文本
        return ratio > 0.6;
    }
}

module.exports = new PDFParserEnhanced();