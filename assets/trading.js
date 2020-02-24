const ChartjsNode = require('chartjs-node');
const Canvas = require('canvas');
const dayjs = require("dayjs")

const typeActions = {
	'open': 'Open',
	'closed': 'Closed',
	'short': 'Short',
	'long': 'Long',
	'closeShort': 'Close Short',
	'closeLong': 'Close Long'
}

const months = {
	'01': 'Jan',
	'02': 'Feb',
	'03': 'Mar',
	'04': 'Apr',
	'05': 'May',
	'06': 'Jun',
	'07': 'Jul',
	'08': 'Aug',
	'09': 'Sep',
	'10': 'Oct',
	'11': 'Nov',
	'12': 'Dec'
}

module.exports.trading = async function (robot, position, candles) {
	const ChartTitle = robot["name"];
	const xAxesFormat = robot["timeframe"] == 1440 ? 'DD MMM' : 'DD MMM HH:mm';
	const chartData = candlesSet(candles);
	const pointData = pointsSet(position);

	const chartNode = new ChartjsNode(1200, 700);

	chartNode.on('beforeDraw', function (Chart) {
		'use strict';

		Chart = Chart && Chart.hasOwnProperty('default') ? Chart['default'] : Chart;

		const helpers = Chart.helpers;
		const defaultConfig = {
			position: 'left',
			ticks: {
				callback: Chart.Ticks.formatters.linear
			}
		};

		Chart.plugins.register({
			beforeDraw: function (chartInstance) {
				const ctx = chartInstance.chart.ctx;
				const backgroundImg = new Canvas.Image();

				backgroundImg.src = "../background.png";

				const pattern = ctx.createPattern(backgroundImg, "repeat");

				ctx.fillStyle = pattern;
				ctx.fillRect(0, 0, chartInstance.chart.width, chartInstance.chart.height);

				ctx.font = `bold 48px 'Roboto', 'Ubuntu', 'Helvetica Neue', 'Helvetica', 'Arial',   sans-serif`;
				ctx.textAlign = "start";
				ctx.fillStyle = '#ffffff';
				ctx.fillText('Trade', 40, 54);

				const profitText = position.profit ? summFormat(position.profit) + "" : summFormat("0");

				ctx.font = `bold 42px 'Roboto', 'Ubuntu', 'Helvetica Neue', 'Helvetica', 'Arial', sans-serif`;
				ctx.textAlign = "end";
				ctx.fillStyle = position.profit > 0 ? '#1CA46B' : '#CD3E60';
				ctx.fillText(profitText[0] != "-" ? "+" + profitText : profitText, chartInstance.chart.width - 40, 54);
			}
		});

		const FinancialLinearScale = Chart.scaleService.getScaleConstructor('linear').extend({
			_parseValue: function (value) {
				let start, end, min, max;

				if (typeof value.c !== 'undefined') {
					start = +this.getRightValue(value.l);
					end = +this.getRightValue(value.h);
					min = Math.min(start, end);
					max = Math.max(start, end);
				} else {
					value = +this.getRightValue(value.y);
					start = undefined;
					end = value;
					min = value;
					max = value;
				}

				return {
					min: min,
					max: max,
					start: start,
					end: end
				};
			},
			determineDataLimits: function () {
				const me = this;
				const chart = me.chart;
				const data = chart.data;

				function IDMatches(meta) {
					return me.isHorizontal() ? meta.xAxisID === me.id : meta.yAxisID === me.id;
				}

				me.min = null;
				me.max = null;

				helpers.each(data.datasets, function (dataset, datasetIndex) {
					const meta = chart.getDatasetMeta(datasetIndex);

					if (chart.isDatasetVisible(datasetIndex) && IDMatches(meta)) {
						helpers.each(dataset.data, function (rawValue, index) {
							const value = me._parseValue(rawValue);

							if (isNaN(value.min) || isNaN(value.max) || meta.data[index].hidden) return;
							if (me.min === null || value.min < me.min) me.min = value.min;
							if (me.max === null || me.max < value.max) me.max = value.max;
						});
					}
				});

				const space = (me.max - me.min) * 0.3;

				me.min -= space;
				me.max += space;

				this.handleTickRangeOptions();
			}
		});

		Chart.scaleService.registerScaleType('financialLinear', FinancialLinearScale, defaultConfig);

		Chart.defaults.financial = {
			label: '',
			scales: {
				xAxes: [{
					type: 'time',
					parser: function (date) {
						return dayjs(date).utc();
					},
					time: {
						unit: 'month',
						displayFormats: { month: xAxesFormat }
					},
					distribution: 'series',
					offset: true,
					ticks: {
						source: 'auto',
						fontSize: 18,
						fontStyle: 'bold',
						fontColor: '#ffffff',
						maxRotation: 0,
						autoSkip: true,
						autoSkipPadding: 50,
						sampleSize: 50
					}
				}],
				yAxes: [{
					type: 'financialLinear',
					distribution: 'series',
					offset: true,
					ticks: {
						major: {
							enabled: true,
							fontStyle: 'bold'
						},
						fontSize: 18,
						fontStyle: 'bold',
						fontColor: '#6987B9',
						source: 'data',
						maxRotation: 0,
						autoSkip: true,
						autoSkipPadding: 25,
						sampleSize: 50
					}
				}]
			}
		};

		const FinancialController = Chart.controllers.bar.extend({
			dataElementType: Chart.elements.Financial,

    		/**
    		 * @private
    		 */
			_updateElementGeometry: function (element, index, reset, options) {
				const me = this;
				const model = element._model;

				const vscale = me._getValueScale();
				const base = vscale.getBasePixel();
				const ruler = me._ruler || me.getRuler();
				const horizontal = vscale.isHorizontal();
				const vpixels = me.calculateBarValuePixels(me.index, index, options);
				const ipixels = me.calculateBarIndexPixels(me.index, index, ruler, options);
				const chart = me.chart;
				const datasets = chart.data.datasets;
				const indexData = datasets[me.index].data[index];

				model.horizontal = horizontal;
				model.base = reset ? base : vpixels.base;
				model.x = horizontal ? reset ? base : vpixels.head : ipixels.center;
				model.y = horizontal ? ipixels.center : reset ? base : vpixels.head;
				model.height = horizontal ? ipixels.size : undefined;
				model.width = horizontal ? undefined : ipixels.size;
				model.candleOpen = vscale.getPixelForValue(Number(indexData.o));
				model.candleHigh = vscale.getPixelForValue(Number(indexData.h));
				model.candleLow = vscale.getPixelForValue(Number(indexData.l));
				model.candleClose = vscale.getPixelForValue(Number(indexData.c));
				model.t_data = me._data[index].t
				model.timestamp = me._data[index].timestamp
			},
			draw: function () {
				const ctx = this.chart.chart.ctx;
				const elems = this.getMeta().data;
				const dataset = this.getDataset();

				Chart.canvasHelpers.clipArea(ctx, this.chart.chartArea);

				for (let i = 0; i < elems.length; i++) {
					const d = dataset.data[i].o;

					if (d !== null && d !== undefined && !isNaN(d)) elems[i].draw();
				}

				Chart.canvasHelpers.unclipArea(ctx);
			}
		});

		const globalOpts = Chart.defaults.global;

		globalOpts.elements.financial = {
			color: {
				up: '#1CA46B',
				down: '#CD3E60',
				unchanged: '#999'
			}
		};

		const FinancialElement = Chart.Element.extend({ inRange: () => { } });
		const helpers$1 = Chart.helpers;
		const globalOpts$1 = Chart.defaults.global;

		Chart.defaults.candlestick = Chart.helpers.merge({}, Chart.defaults.financial);
		Chart.defaults.helperpoint = Chart.helpers.merge({}, Chart.defaults.financial);

		globalOpts$1.elements.candlestick = helpers$1.merge({}, [globalOpts$1.elements.financial, {
			borderColor: globalOpts$1.elements.financial.color.unchanged,
			borderWidth: 2,
		}]);


		Chart.defaults._set('global', {
			datasets: {
				candlestick: Chart.defaults.global.datasets.bar,
				helperpoint: Chart.defaults.global.datasets.bar
			}
		});

		const CandlestickElement = FinancialElement.extend({
			draw: function () {
				const _chart = this._chart
				const ctx = _chart.ctx;
				const vm = this._view;

				const x = vm.x;
				const o = vm.candleOpen;
				const h = vm.candleHigh;
				const l = vm.candleLow;
				const c = vm.candleClose;
				const t = vm.t_data;
				const timestamp = vm.timestamp

				let borderColors = vm.borderColor;

				if (typeof borderColors === 'string') {
					borderColors = {
						up: borderColors,
						down: borderColors,
						unchanged: borderColors
					};
				}

				let borderColor;

				if (c < o) {
					borderColor = helpers$1.getValueOrDefault(borderColors ? borderColors.up : undefined, globalOpts$1.elements.candlestick.color.up);
					ctx.fillStyle = helpers$1.getValueOrDefault(vm.color ? vm.color.up : undefined, globalOpts$1.elements.candlestick.color.up);
				} else if (c > o) {
					borderColor = helpers$1.getValueOrDefault(borderColors ? borderColors.down : undefined, globalOpts$1.elements.candlestick.color.down);
					ctx.fillStyle = helpers$1.getValueOrDefault(vm.color ? vm.color.down : undefined, globalOpts$1.elements.candlestick.color.down);
				} else {
					borderColor = helpers$1.getValueOrDefault(borderColors ? borderColors.unchanged : undefined, globalOpts$1.elements.candlestick.color.unchanged);
					ctx.fillStyle = helpers$1.getValueOrDefault(vm.color ? vm.color.unchanged : undefined, globalOpts$1.elements.candlestick.color.unchanged);
				}

				ctx.lineWidth = helpers$1.getValueOrDefault(vm.borderWidth, globalOpts$1.elements.candlestick.borderWidth);
				ctx.strokeStyle = helpers$1.getValueOrDefault(borderColor, globalOpts$1.elements.candlestick.borderColor);

				ctx.beginPath();
				ctx.moveTo(x, h);
				ctx.lineTo(x, Math.min(o, c));
				ctx.moveTo(x, l);
				ctx.lineTo(x, Math.max(o, c));
				ctx.stroke();
				ctx.fillRect(x - vm.width / 6, c, vm.width / 3, o - c);
				ctx.closePath();

				for (let k = 0; k < pointData.length; k++) {
					if (pointData[k].timestamp == timestamp) {
						fillPoin(_chart, { x, h, l, elem: pointData[k], width: vm.width / 6 })
					}
				}
			},
		});

		const HelperPointElement = FinancialElement.extend({
			draw: function () {
				const ctx = this._chart.ctx;
				const vm = this._view;
			}
		});

		Chart.controllers.helperpoint = FinancialController.extend({
			dataElementType: HelperPointElement,
			updateElement: function (element, index, reset) {
				const meta = this.getMeta();
				const dataset = this.getDataset();
				const options = this._resolveDataElementOptions(element, index);

				element._xScale = this.getScaleForId(meta.xAxisID);
				element._yScale = this.getScaleForId(meta.yAxisID);
				element._datasetIndex = this.index;
				element._index = index;

				element._model = {
					datasetLabel: dataset.label || '',
					color: dataset.color,
					borderColor: dataset.borderColor,
					borderWidth: dataset.borderWidth,
				};

				this._updateElementGeometry(element, index, reset, options);

				element.pivot();
			}
		});

		Chart.controllers.candlestick = FinancialController.extend({
			dataElementType: CandlestickElement,
			updateElement: function (element, index, reset) {
				const meta = this.getMeta();
				const dataset = this.getDataset();
				const options = this._resolveDataElementOptions(element, index);

				element._xScale = this.getScaleForId(meta.xAxisID);
				element._yScale = this.getScaleForId(meta.yAxisID);
				element._datasetIndex = this.index;
				element._index = index;

				element._model = {
					datasetLabel: dataset.label || '',
					color: dataset.color,
					borderColor: dataset.borderColor,
					borderWidth: dataset.borderWidth,
				};

				this._updateElementGeometry(element, index, reset, options);

				element.pivot();
			},

		});
	});

	const chartJsOptions = {
		type: 'candlestick',
		data: {
			datasets: [
				{
					label: ChartTitle,
					type: 'candlestick',
					data: chartData,
					color: {
						up: '#1CA46B',
						down: '#CD3E60',
						unchanged: '#999'
					}
				}
			]
		},
		options: {
			layout: {
				padding: 20,
				backgroundColor: 'rgba(251, 85, 85, 0.4)',
			},
			legend: {
				display: true,
				position: 'top',
				padding: 0,
				align: 'center',
				labels: {
					fontSize: 48,
					fontFamily: "'Helvetica Neue', 'Helvetica', 'Arial', sans-serif",
					fontColor: '#FFFFFF',
					boxWidth: 0
				}
			},
			scales: {
				xAxes: [{}],
				yAxes: [{
					position: 'right'
				}]
			}
		}
	};

	function fillPoin(_chart, params) {
		const ctx = _chart.ctx,
			data = params.elem,
			dateTime = dateTimeFormat(data.date),
			circleClr = ctx.createLinearGradient(0, 20, 0, 0);

		let y, borderClr, firstClr, secondClr;

		if (data.action == "short" || data.action == "closeShort") {
			borderClr = 'rgba(189, 54, 86, 0.2)';
			firstClr = "#D63535";
			secondClr = "#9952E0";
		} else if (data.action == "long" || data.action == "closeLong") {
			borderClr = 'rgba(25, 140, 127, 0.2)';
			firstClr = "#198C7F";
			secondClr = "#16B3EA";
		}

		if (data.action == 'long' || data.action == 'closeShort') {
			y = (params.l < params.h ? params.h : params.l) + 17
		} else {
			y = (params.l < params.h ? params.l : params.h) - 10
		}

		ctx.fillStyle = borderClr
		ctx.beginPath();
		ctx.arc(params.x, y - 4, 13, 0, 2 * Math.PI);
		ctx.fill();
		ctx.closePath();

		circleClr.addColorStop(0, firstClr);
		circleClr.addColorStop(1, secondClr);

		ctx.fillStyle = circleClr;
		ctx.beginPath();
		ctx.arc(params.x, y - 4, 10, 0, 2 * Math.PI);
		ctx.fill();
		ctx.closePath();

		const shift = params.x + 200 > _chart.width ? 100 : params.x - 150 < 100 ? -100 : 0;
		setExplanation(ctx, params.x, y, data, dateTime, shift, data.type)

		ctx.beginPath();
		ctx.fillStyle = "#ffffff";

		if (data.action == "long" || data.action == "closeShort") {
			ctx.moveTo(params.x - 6, y - 2);
			ctx.lineTo(params.x + 6, y - 2);
			ctx.lineTo(params.x, y - 8);
		} else if (data.action == "short" || data.action == "closeLong") {
			ctx.moveTo(params.x, y);
			ctx.lineTo(params.x - 6, y - 6);
			ctx.lineTo(params.x + 6, y - 6);
		}

		ctx.fill();
		ctx.closePath();

		setSalePoint(_chart, params.x, data.price, params.width)

		ctx.globalCompositeOperation = "source-over";
	}

	function setSalePoint(_chart, x, y, width, color = '#FF0000') {
		const ctx = _chart.ctx

		ctx.beginPath();
		ctx.arc(x, getYRatio(_chart, y), width, 0, 2 * Math.PI);
		ctx.fillStyle = color;
		ctx.fill();
		ctx.closePath();
	}

	function getYRatio(chart, value) {
		const smin = chart.scales['y-axis-0'].min
		const smax = chart.scales['y-axis-0'].max
		const dmin = chart.height - 125
		const dmax = 140

		return ((value - smin) / (smax - smin)) * (dmax - dmin) + dmin;
	}

	function setExplanation(ctx, x, y, data, dateTime, shift, type) {
		if (data.action == 'long' || data.action == 'closeShort') {
			ctx.beginPath();
			ctx.moveTo(x, y + 8);
			ctx.lineTo(x - 4, y + 16);
			ctx.arcTo(x - shift - 110, y + 16, x - shift - 110, y + 24, 4);
			ctx.arcTo(x - shift - 110, y + 116, x - shift - 102, y + 116, 4);
			ctx.arcTo(x - shift + 110, y + 116, x - shift + 110, y + 112, 4);
			ctx.arcTo(x - shift + 110, y + 16, x - shift + 102, y + 16, 4);
			ctx.lineTo(x + 4, y + 16);
			ctx, lineWidth = 1
			ctx.fillStyle = "#3D4977";
			ctx.strokeStyle = "#39436A";
			ctx.stroke();
			ctx.fill();
			ctx.closePath();

			ctx.font = "bold 24px 'Helvetica Neue', 'Helvetica', 'Arial', 'sans-serif'";
			ctx.fillStyle = "#ffffff";
			ctx.textAlign = "center";
			ctx.fillText(dateTime, x - shift, y + 97);
			ctx.fillText(summFormat(data.price), x - shift, y + 67);
			ctx.fillText(typeActions[data.action] + ": " + data.code, x - shift, y + 37);
		} else {
			ctx.beginPath();
			ctx.moveTo(x, y - 18);
			ctx.lineTo(x - 4, y - 24);
			ctx.arcTo(x - shift - 110, y - 24, x - shift - 110, y - 32, 4);
			ctx.arcTo(x - shift - 110, y - 124, x - shift - 102, y - 124, 4);
			ctx.arcTo(x - shift + 110, y - 124, x - shift + 110, y - 120, 4);
			ctx.arcTo(x - shift + 110, y - 24, x - shift + 102, y - 24, 4);
			ctx.lineTo(x + 4, y - 24);
			ctx, lineWidth = 1
			ctx.fillStyle = "#3D4977";
			ctx.strokeStyle = "#39436A";
			ctx.stroke();
			ctx.fill();
			ctx.closePath();

			ctx.font = "bold 24px 'Helvetica Neue', 'Helvetica', 'Arial', 'sans-serif'";
			ctx.fillStyle = "#ffffff";
			ctx.textAlign = "center";
			ctx.fillText(dateTime, x - shift, y - 43);
			ctx.fillText(summFormat(data.price), x - shift, y - 73);
			ctx.fillText(typeActions[data.action] + ": " + data.code, x - shift, y - 103);
		}
	}

	function summFormat(params) {
		let enterNum = params;

		if (typeof enterNum !== "integer") enterNum = +params

		let num = enterNum.toFixed(2)
		let nums = num.split(".")
		let finalStr = nums[0].toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1,') + "." + nums[1] + " $"

		return finalStr
	}

	function dateTimeFormat(params) {
		let dateTimeStrs = params.split("T")
		let date = `${dateTimeStrs[0].split("-")[2]} ${months[dateTimeStrs[0].split("-")[1]]}`
		let time = `${dateTimeStrs[1].split(":")[0]}:${dateTimeStrs[1].split(":")[1]}`

		return `${date} ${time}`
	}

	function candlesSet(params) {
		const candlesArr = [];

		for (let i = 0; i < params.length; i++) {
			candlesArr.push({
				t: params[i].time,
				o: params[i].open,
				h: params[i].high,
				l: params[i].low,
				c: params[i].close,
				timestamp: params[i].timestamp
			})
		}

		return candlesArr;
	}

	function pointsSet(params) {
		const pointsArr = [];

		pointsArr.push({
			type: "enter",
			code: params.code,
			price: params.entryPrice,
			date: params.entryDate,
			timestamp: params.entryCandleTimestamp,
			action: params.entryAction,
		})

		if (params.status == 'closed' && params.exitAction != null) {
			pointsArr.push({
				type: "exit",
				code: params.code,
				price: params.exitPrice,
				date: params.exitDate,
				timestamp: params.exitCandleTimestamp,
				action: params.exitAction,
			})
		}

		return pointsArr
	}

	return chartNode.drawChart(chartJsOptions).then(() => {
		return chartNode.getImageBuffer('image/png');
	}).then(buffer => {
		Array.isArray(buffer)
		return chartNode.getImageStream('image/png');
	}).then(streamResult => {
		const fileName = `${position.code}_` + robot.name.replace(/ /g, "_").replace(/\//g, "_");

		streamResult.stream
		streamResult.length
		return chartNode.writeImageToFile('image/png', `./dest/${fileName}.png`);
	}).then(() => { });
}