// 颜色工具类 - 为不同算子生成唯一颜色
export class ColorUtils {
    static operatorColors = new Map();
    static colorPalette = [
        // 20种高对比度颜色
        [0.121, 0.466, 0.705, 1.0],   // #1f77b4 - 蓝色
        [0.890, 0.101, 0.109, 1.0],   // #e31a1c - 红色
        [0.215, 0.610, 0.341, 1.0],   // #378e41 - 绿色
        [0.596, 0.305, 0.639, 1.0],   // #984ea3 - 紫色
        [1.000, 0.498, 0.000, 1.0],   // #ff7f00 - 橙色
        [0.550, 0.341, 0.290, 1.0],   // #8c564b - 棕色
        [0.965, 0.592, 0.117, 1.0],   // #f6b117 - 金色
        [0.500, 0.500, 0.500, 1.0],   // #808080 - 灰色
        [0.800, 0.470, 0.737, 1.0],   // #cc78bc - 粉红
        [0.580, 0.403, 0.741, 1.0],   // #9467bd - 紫罗兰
        [0.800, 0.725, 0.454, 1.0],   // #ccb974 - 沙色
        [0.172, 0.627, 0.172, 1.0],   // #2ca02c - 深绿
        [0.839, 0.152, 0.156, 1.0],   // #d62728 - 深红
        [0.549, 0.337, 0.294, 1.0],   // #8c564b - 咖啡
        [0.890, 0.466, 0.760, 1.0],   // #e377c2 - 玫红
        [0.498, 0.498, 0.498, 1.0],   // #7f7f7f - 中灰
        [0.737, 0.741, 0.133, 1.0],   // #bcbd22 - 橄榄
        [0.090, 0.745, 0.811, 1.0],   // #17becf - 青蓝
        [0.800, 0.800, 0.800, 1.0],   // #cccccc - 浅灰
        [0.000, 0.000, 0.000, 1.0]    // #000000 - 黑色
    ];

    // 根据算子ID获取颜色
    static getColorForOperator(operatorId) {
        if (!this.operatorColors.has(operatorId)) {
            const colorIndex = this.operatorColors.size % this.colorPalette.length;
            this.operatorColors.set(operatorId, this.colorPalette[colorIndex]);
        }
        return this.operatorColors.get(operatorId);
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