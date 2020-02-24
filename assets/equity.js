const ChartjsNode = require('chartjs-node');
const Canvas = require('canvas');
const dayjs = require('dayjs');

function getSales(params) {
	const candlesArr = [];

	for (let i = 0; i < params.length; i++) candlesArr.push(params[i].y);

	return candlesArr;
}

function getDates(params) {
	const datesArr = [];

	for (let i = 0; i < params.length; i++) {
		const date = dayjs.unix((params[i].x / 1000))

		datesArr.push(date.format("YYYY-MM-DD"))
	}

	return datesArr;
}

function summFormat(params) {
	let enterNum = params;

	if (typeof enterNum !== "integer") enterNum = +params

	let num = enterNum.toFixed(2)
	let nums = num.split(".")
	let finalStr = nums[0].toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1,') + "." + nums[1] + " $"

	return finalStr
}

function getGradient(type) {
	const ctx = new Canvas().getContext('2d')

	let gradient = ctx.createLinearGradient(0, 600);

	gradient.addColorStop(1, 'rgba(' + (type == "top" ? '105, 218, 205' : '237, 56, 99') + ', .5)');
	gradient.addColorStop(0, '#2C3454');

	return gradient
}

module.exports.equity = async function (robot) {
	const chartNode = new ChartjsNode(1200, 700);

	chartNode.on('beforeDraw', function (Chart) {
		'use strict';

		Chart = Chart && Chart.hasOwnProperty('default') ? Chart['default'] : Chart;

		Chart.plugins.register({
			beforeDraw: chartInstance => {
				const ctx = chartInstance.chart.ctx;
				const backgroundImg = new Canvas.Image();

				backgroundImg.src =  __dirname + "/background.png";

				const pattern = ctx.createPattern(backgroundImg, "repeat");

				ctx.fillStyle = pattern;
				ctx.fillRect(0, 0, chartInstance.chart.width, chartInstance.chart.height);

				const profitVal = robot.profit ? summFormat(robot.profit) + "" : summFormat("0");
				const profitText = profitVal[0] != "-" ? "+" + profitVal : profitVal
				const robotName = robot.name
				const fonts = `'Roboto', 'Ubuntu', 'Helvetica Neue', 'Helvetica', 'Arial', sans-serif`

				ctx.font = `bold 40px ` + fonts;
				ctx.textAlign = "end";
				ctx.fillStyle = '#FFFFFF';
				ctx.fillText(robotName, ctx.measureText(robotName).width + 30, 64);
				ctx.font = `bold 42px ` + fonts;
				ctx.fillStyle = robot.profit > 0 ? '#1CA46B' : '#CD3E60';
				ctx.fillText(profitText, ctx.measureText(profitText).width + 30, 120);
				ctx.fillStyle = '#6987B9';
				ctx.fillText(dayjs().format('DD MMM HH:mm UTC'), chartInstance.chart.width - 30, 64);
			},
		});

		Chart.defaults.multicolorLine = Chart.defaults.line;

		Chart.controllers.multicolorLine = Chart.controllers.line.extend({
			draw: function () {
				const meta = this.getMeta();
				const points = meta.data || [];
				const dataset = this.getDataset();
				const colors = dataset.colors;
				const data = dataset.data;
				const area = this.chart.chartArea;
				const originalDatasets = meta.dataset._children.filter(data => { return !isNaN(data._view.y) });

				let startIndex = 0;

				function _setColor(newColor, meta) {
					meta.dataset._view.borderColor = newColor;
				}

				for (let i = 0; i < points.length; i++) {
					let color = data[i] > 0 ? colors.up : colors.down

					_setColor(color, meta);

					meta.dataset._children = originalDatasets.slice(startIndex, i);
					meta.dataset.draw();
					startIndex = i - 1;
				}

				meta.dataset._children = originalDatasets.slice(startIndex);
				meta.dataset.draw();
				meta.dataset._children = originalDatasets;

				points.forEach(point => { point.draw(area) });
			}
		});
	})

	const chartJsOptions = {
		type: 'multicolorLine',
		data: {
			labels: getDates(robot.equity),
			datasets: [{
				data: getSales(robot.equity),
				label: robot.name,
				pointStyle: 'dash',
				fill: 'origin',
				backgroundColor: getGradient(robot.profit > 0 ? 'top' : false, chartNode),
				pointHoverBorderWidth: 0,
				colors: {
					up: '#65F5E5',
					down: '#CD3E60'
				}
			}]
		},
		options: {
			elements: {
				line: { tension: 0 }
			},
			layout: {
				padding: {
					top: 130,
					left: 30,
					right: 30,
					bottom: 30
				},
			},
			legend: {
				display: false,
				position: 'top',
				padding: -50,
				align: 'start',
				labels: {
					fontSize: 48,
					fontFamily: "'Helvetica Neue', 'Helvetica', 'Arial', sans-serif",
					fontColor: '#FFFFFF',
					boxWidth: 0
				}
			},
			scales: {
				xAxes: [{
					type: 'time',
					distribution: 'series',
					display: false,
				}],
				yAxes: [{ display: false }]
			}
		}
	}

	return chartNode.drawChart(chartJsOptions).then(() => {
		return chartNode.getImageBuffer('image/png');
	}).then(buffer => {
		Array.isArray(buffer)
		return chartNode.getImageStream('image/png');
	}).then(streamResult => {
		const fileName = (robot.name + "_" + dayjs().format('DD MMM HH:mm')).replace(/ /g, "_").replace(/\//g, "_");

		return chartNode.writeImageToFile('image/png', `./dest/${fileName}.png`);
	}).then(() => { });
}