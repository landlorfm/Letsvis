// 颜色工具类 - 为不同算子生成唯一颜色
export class ColorUtils {
    static operatorColors = new Map();
    static colorPalette = [
    //     // 20种高对比度颜色
    //     [0.121, 0.466, 0.705, 1.0],   // #1f77b4 - 蓝色
    //     [0.890, 0.101, 0.109, 1.0],   // #e31a1c - 红色
    //     [0.215, 0.610, 0.341, 1.0],   // #378e41 - 绿色
    //     [0.596, 0.305, 0.639, 1.0],   // #984ea3 - 紫色
    //     [1.000, 0.498, 0.000, 1.0],   // #ff7f00 - 橙色
    //     [0.550, 0.341, 0.290, 1.0],   // #8c564b - 棕色
    //     [0.965, 0.592, 0.117, 1.0],   // #f6b117 - 金色
    //     [0.500, 0.500, 0.500, 1.0],   // #808080 - 灰色
    //     [0.800, 0.470, 0.737, 1.0],   // #cc78bc - 粉红
    //     [0.580, 0.403, 0.741, 1.0],   // #9467bd - 紫罗兰
    //     [0.800, 0.725, 0.454, 1.0],   // #ccb974 - 沙色
    //     [0.172, 0.627, 0.172, 1.0],   // #2ca02c - 深绿
    //     [0.839, 0.152, 0.156, 1.0],   // #d62728 - 深红
    //     [0.549, 0.337, 0.294, 1.0],   // #8c564b - 咖啡
    //     [0.890, 0.466, 0.760, 1.0],   // #e377c2 - 玫红
    //     [0.498, 0.498, 0.498, 1.0],   // #7f7f7f - 中灰
    //     [0.737, 0.741, 0.133, 1.0],   // #bcbd22 - 橄榄
    //     [0.090, 0.745, 0.811, 1.0],   // #17becf - 青蓝
    //     [0.800, 0.800, 0.800, 1.0],   // #cccccc - 浅灰
    //     [0.000, 0.000, 0.000, 1.0]    // #000000 - 黑色
    // ];

    // 1  Blue 深浅延伸
    [0.12156862745098039, 0.4666666666666667, 0.7058823529411765, 1.0],
    [0.6823529411764706, 0.7803921568627451, 0.9098039215686274, 1.0],
    [0.05098039215686274, 0.3176470588235294, 0.5215686274509804, 1.0],

    // 2  Green 深浅延伸
    [0.17254901960784313, 0.6274509803921569, 0.17254901960784313, 1.0],
    [0.596078431372549, 0.8745098039215686, 0.5411764705882353, 1.0],
    [0.09411764705882353, 0.4470588235294118, 0.09411764705882353, 1.0],

    // 3  Red 深浅延伸
    [0.8392156862745098, 0.15294117647058825, 0.1568627450980392, 1.0],
    [1.0, 0.596078431372549, 0.5882352941176471, 1.0],
    [0.6235294117647059, 0.10196078431372549, 0.10588235294117647, 1.0],

    // 4  Purple 深浅延伸
    [0.5803921568627451, 0.403921568627451, 0.7411764705882353, 1.0],
    [0.7725490196078432, 0.6901960784313725, 0.8352941176470589, 1.0],
    [0.40784313725490196, 0.26666666666666666, 0.5607843137254902, 1.0],

    // 5  Brown 深浅延伸
    [0.5490196078431373, 0.33725490196078434, 0.29411764705882354, 1.0],
    [0.7686274509803922, 0.611764705882353, 0.5803921568627451, 1.0],
    [0.37254901960784315, 0.2235294117647059, 0.19215686274509805, 1.0],

    // 6  Pink 深浅延伸
    [0.8901960784313725, 0.4666666666666667, 0.7607843137254902, 1.0],
    [0.9686274509803922, 0.7137254901960784, 0.8235294117647058, 1.0],
    [0.7019607843137254, 0.3176470588235294, 0.596078431372549, 1.0],

    // 7  Gray 深浅延伸
    [0.4980392156862745, 0.4980392156862745, 0.4980392156862745, 1.0],
    [0.7803921568627451, 0.7803921568627451, 0.7803921568627451, 1.0],
    [0.3176470588235294, 0.3176470588235294, 0.3176470588235294, 1.0],

    // 8  Olive 深浅延伸
    [0.7372549019607844, 0.7411764705882353, 0.13333333333333333, 1.0],
    [0.8588235294117647, 0.8588235294117647, 0.5529411764705883, 1.0],
    [0.5176470588235295, 0.5215686274509804, 0.09019607843137255, 1.0],

    // 9  Cyan 深浅延伸
    [0.09019607843137255, 0.7450980392156863, 0.8117647058823529, 1.0],
    [0.6196078431372549, 0.8549019607843137, 0.8980392156862745, 1.0],
    [0.047058823529411764, 0.5803921568627451, 0.6392156862745098, 1.0],

    // 10 Orange 深浅延伸
    [0.6941176470588235, 0.34901960784313724, 0.1568627450980392, 1.0],
    [0.9372549019607843, 0.5411764705882353, 0.3843137254901961, 1.0],
    [0.5176470588235295, 0.24313725490196078, 0.10196078431372549, 1.0],

    // 11 第二组 Blue（微调色相）
    [0.2, 0.4, 0.8, 1.0],
    [0.65, 0.75, 0.95, 1.0],
    [0.1, 0.3, 0.6, 1.0],

    // 12 第二组 Green（微调色相）
    [0.2, 0.7, 0.3, 1.0],
    [0.7, 0.9, 0.6, 1.0],
    [0.12, 0.52, 0.18, 1.0],

    // 13 第二组 Red（微调色相）
    [0.9, 0.25, 0.25, 1.0],
    [1.0, 0.65, 0.65, 1.0],
    [0.7, 0.15, 0.15, 1.0],

    // 14 第二组 Purple（微调色相）
    [0.65, 0.45, 0.85, 1.0],
    [0.82, 0.75, 0.9, 1.0],
    [0.45, 0.3, 0.65, 1.0],

    // 15 第二组 Brown（微调色相）
    [0.6, 0.4, 0.35, 1.0],
    [0.8, 0.65, 0.6, 1.0],
    [0.4, 0.25, 0.2, 1.0],

    // 16 第二组 Pink（微调色相）
    [0.95, 0.5, 0.8, 1.0],
    [1.0, 0.75, 0.9, 1.0],
    [0.75, 0.35, 0.65, 1.0],

    // 17 第二组 Gray（冷灰）
    [0.55, 0.55, 0.6, 1.0],
    [0.8, 0.8, 0.85, 1.0],
    [0.35, 0.35, 0.4, 1.0],

    // 18 第二组 Olive（偏黄）
    [0.8, 0.8, 0.2, 1.0],
    [0.9, 0.9, 0.55, 1.0],
    [0.55, 0.55, 0.1, 1.0],

    // 19 第二组 Cyan（偏青）
    [0.1, 0.8, 0.85, 1.0],
    [0.65, 0.9, 0.93, 1.0],
    [0.05, 0.6, 0.65, 1.0],

    // 20 第二组 Orange（偏黄橙）
    [0.8, 0.5, 0.15, 1.0],
    [0.95, 0.7, 0.45, 1.0],
    [0.55, 0.35, 0.08, 1.0]
     ];

    static getTab20Color(index, alpha = 1) {
        const tab20 = this.colorPalette;
        const base =  tab20[index % tab20.length];
        return [base[0], base[1], base[2], alpha];
    }



    // 根据算子ID获取颜色
    // static getColorForOperator(operatorId) {
    //     if (!this.operatorColors.has(operatorId)) {
    //         const colorIndex = this.operatorColors.size % this.colorPalette.length;
    //         this.operatorColors.set(operatorId, this.colorPalette[colorIndex]);
    //     }
    //     return this.operatorColors.get(operatorId);
    // }
    static getColorForOperator(operatorId, alpha = 1.0) {
        if (!this.operatorColors.has(operatorId)) {
            const colorIndex = this.operatorColors.size % this.colorPalette.length;
            const baseColor = [...this.colorPalette[colorIndex]]; // 复制一份避免污染原始颜色
            baseColor[3] = alpha; // 设置透明度
            this.operatorColors.set(operatorId, baseColor);
        }

        const color = this.operatorColors.get(operatorId);
        // 如果传入的 alpha 和缓存的不一致，更新透明度
        const newColor = [...color];
        newColor[3] = alpha;
        return newColor;
    }

    // 获取操作类型的基础颜色（用于泳道背景）
    static getBaseColorForOperationType(type) {
        const baseColors = {
            compute: [0.95, 0.95, 0.95, 0.3],  // 浅灰半透明
            load:    [0.95, 0.98, 0.95, 0.3],  // 浅绿半透明
            store:   [0.98, 0.95, 0.95, 0.3]   // 浅红半透明
        };
        return baseColors[type] || [0.9, 0.9, 0.9, 0.3];
    }

  
    // // 获取高亮颜色（在基础颜色上明显变亮）
    // static getHighlightColor(baseColor) {
    //     return [
    //         Math.min(baseColor[0] + 0.3, 1.0),  // 增加亮度幅度
    //         Math.min(baseColor[1] + 0.3, 1.0),
    //         Math.min(baseColor[2] + 0.3, 1.0),
    //         Math.min(baseColor[3] + 0.2, 1.0)   // 增加透明度
    //     ];
    // }


    // 获取高亮边框颜色
    static getHighlightBorderColor(baseColor) {
        // 计算相对亮度
        const brightness = (baseColor[0] * 299 + baseColor[1] * 587 + baseColor[2] * 114) / 1000;
        
        // 根据亮度选择边框颜色
        return brightness > 0.5 ? 
            [0, 0, 0, 1.0] :  // 暗色边框用于亮背景
            [1, 1, 1, 1.0];   // 亮色边框用于暗背景
    }
    
    // 获取发光效果颜色
    static getGlowColor(baseColor) {
        // 使用互补色或类似色创建发光效果
        return [
            (baseColor[0] + 0.5) % 1.0,
            (baseColor[1] + 0.3) % 1.0,
            (baseColor[2] + 0.7) % 1.0,
            0.6  // 半透明
        ];
    }
    
    // 增强高亮效果 - 多种策略
    static getHighlightColor(baseColor, strategy = 'border') {
        switch(strategy) {
            case 'border':
                return this.getHighlightBorderColor(baseColor);
            case 'glow':
                return this.getGlowColor(baseColor);
            case 'invert':
                return this.getInvertedColor(baseColor);
            case 'saturate':
                return this.getSaturatedColor(baseColor);
            default:
                return this.getDefaultHighlight(baseColor);
        }
    }
    
    // 反色高亮
    static getInvertedColor(baseColor) {
        return [
            1.0 - baseColor[0],
            1.0 - baseColor[1],
            1.0 - baseColor[2],
            1.0  // 完全不透明
        ];
    }
    
    // 提高饱和度
    static getSaturatedColor(baseColor) {
        const [r, g, b, a] = baseColor;
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const delta = max - min;
        
        if (delta === 0) return baseColor; // 灰度颜色
        
        const saturation = 1.5; // 饱和度增加50%
        const factor = (1 - saturation) * delta;
        
        return [
            Math.min(1.0, r + (r - min) * factor / delta),
            Math.min(1.0, g + (g - min) * factor / delta),
            Math.min(1.0, b + (b - min) * factor / delta),
            a
        ];
    }
    
    // 默认高亮策略
    static getDefaultHighlight(baseColor) {
        // 使用HSL颜色空间调整亮度
        const [h, s, l] = this.rgbToHsl(baseColor[0], baseColor[1], baseColor[2]);
        const newL = Math.min(0.9, l + 0.3); // 显著提高亮度
        
        const rgb = this.hslToRgb(h, s, newL);
        return [rgb[0], rgb[1], rgb[2], baseColor[3]];
    }
    
    // RGB转HSL
    static rgbToHsl(r, g, b) {
        r /= 255; g /= 255; b /= 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;

        if (max === min) {
            h = s = 0; // 灰度
        } else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }
        return [h, s, l];
    }
    
    // HSL转RGB
    static hslToRgb(h, s, l) {
        let r, g, b;

        if (s === 0) {
            r = g = b = l; // 灰度
        } else {
            const hue2rgb = (p, q, t) => {
                if (t < 0) t += 1;
                if (t > 1) t -= 1;
                if (t < 1/6) return p + (q - p) * 6 * t;
                if (t < 1/2) return q;
                if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
                return p;
            };

            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;
            r = hue2rgb(p, q, h + 1/3);
            g = hue2rgb(p, q, h);
            b = hue2rgb(p, q, h - 1/3);
        }

        return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
    }



    // 获取选中颜色（在基础颜色上变深）
    static getSelectedColor(baseColor) {
        return [
            Math.max(baseColor[0] - 0.1, 0.0),
            Math.max(baseColor[1] - 0.1, 0.0),
            Math.max(baseColor[2] - 0.1, 0.0),
            baseColor[3] + 0.2
        ];
    }

    // 重置颜色映射（用于清除状态）
    static resetColorMap() {
        this.operatorColors.clear();
    }

    // RGBA数组转CSS颜色字符串
    static rgbaToCss(rgba) {
        return `rgba(${Math.round(rgba[0] * 255)}, ${Math.round(rgba[1] * 255)}, ${Math.round(rgba[2] * 255)}, ${rgba[3]})`;
    }

    // 生成操作类型的边框颜色
    static getBorderColorForType(type) {
        const borderColors = {
            compute: [0.7, 0.7, 0.7, 0.8],  // 灰色边框
            load:    [0.5, 0.8, 0.5, 0.8],  // 绿色边框
            store:   [0.8, 0.5, 0.5, 0.8]   // 红色边框
        };
        return borderColors[type] || [0.6, 0.6, 0.6, 0.8];
    }
}