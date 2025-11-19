"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Area, ComposedChart } from 'recharts'
import { ArrowUp, ArrowDown, Activity, Zap, BarChart3, TrendingUp, Calendar, Layers } from "lucide-react"

type Prediction = {
  ticker: string
  model: string
  direction: string
  probability: number
  feature_importance?: Record<string, number>
  forecast_dates?: string[]
  forecast_values?: number[]
  predicted_price?: number
}

export default function Dashboard() {
  const [ticker, setTicker] = useState("SPY")
  const [model, setModel] = useState("xgboost")
  const [horizon, setHorizon] = useState([14])
  const [loading, setLoading] = useState(false)
  const [prediction, setPrediction] = useState<Prediction | null>(null)
  const [history, setHistory] = useState<any[]>([])

  const fetchPrediction = async () => {
    setLoading(true)
    try {
      const res = await fetch("http://localhost:8000/api/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker,
          model,
          horizon: horizon[0]
        })
      })
      const data = await res.json()
      setPrediction(data)
    } catch (error) {
      console.error("Failed to fetch prediction:", error)
    } finally {
      setLoading(false)
    }
  }

  const fetchHistory = async () => {
    try {
      const res = await fetch(`http://localhost:8000/api/history?ticker=${ticker}&period=1y`)
      const data = await res.json()
      setHistory(data)
    } catch (error) {
      console.error("Failed to fetch history:", error)
    }
  }

  useEffect(() => {
    fetchHistory()
  }, [ticker])

  // Combine history and forecast for charting
  const getChartData = () => {
      const data = history.map(h => ({
          Date: h.Date,
          Close: h.Close,
          Forecast: null,
          isForecast: false
      }));

      if (prediction?.forecast_dates && prediction?.forecast_values) {
          // Check if forecast connects to history
          const lastHistoryDate = data.length > 0 ? data[data.length - 1].Date : "";
          
          prediction.forecast_dates.forEach((date, i) => {
              // Avoid duplicates if any
              if (date > lastHistoryDate) {
                  data.push({
                      Date: date,
                      Close: null, // Or connect lines?
                      Forecast: prediction.forecast_values![i],
                      isForecast: true
                  })
              }
          })
      }
      return data;
  }

  const chartData = getChartData();

  // Connect the last history point to the first forecast point for visual continuity
  if (prediction?.forecast_values && history.length > 0) {
     const lastHist = chartData.find(d => d.isForecast === false && d.Date === history[history.length-1].Date);
     if (lastHist) {
         // We add a bridge point? 
         // Recharts handles nulls by breaking lines. 
         // To connect, we need the previous point to have both values or overlap.
         // Simpler: Just let them be separate or add a connecting line if needed.
         // Let's try to fill the gap by setting 'Forecast' on the last history point
         // to the current Close, effectively starting the green line from there.
         lastHist.Forecast = lastHist.Close;
     }
  }

  return (
    <div className="min-h-screen bg-black text-white p-8 font-sans selection:bg-blue-500/30">
      <header className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/10 pb-6">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            MarketFocus AI
          </h1>
          <p className="text-slate-400 mt-1 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Institutional-Grade Prediction Engine
          </p>
        </div>
        <div className="flex items-center gap-4">
            <Badge variant="outline" className="border-white/20 text-slate-300 px-3 py-1">v1.0.0</Badge>
            {prediction && (
                <Badge className={`px-4 py-1 text-md font-bold ${
                    prediction.direction === "UP" 
                    ? "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border-emerald-500/50 border" 
                    : "bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 border-rose-500/50 border"
                }`}>
                    SIGNAL: {prediction.direction}
                </Badge>
            )}
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Controls */}
        <Card className="lg:col-span-3 bg-zinc-900/50 border-white/10 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
                <Layers className="w-5 h-5 text-indigo-400" />
                Configuration
            </CardTitle>
            <CardDescription className="text-slate-400">Tune your prediction parameters</CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            <div className="space-y-3">
              <label className="text-sm font-medium text-slate-300">Asset Class</label>
              <Select value={ticker} onValueChange={setTicker}>
                <SelectTrigger className="bg-black/40 border-white/10 text-white focus:ring-indigo-500">
                  <SelectValue placeholder="Select ETF" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-white/10 text-white">
                  <SelectItem value="SPY">SPY (S&P 500)</SelectItem>
                  <SelectItem value="QQQ">QQQ (Nasdaq 100)</SelectItem>
                  <SelectItem value="IWM">IWM (Russell 2000)</SelectItem>
                  <SelectItem value="DIA">DIA (Dow Jones)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <label className="text-sm font-medium text-slate-300">Model Architecture</label>
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger className="bg-black/40 border-white/10 text-white focus:ring-indigo-500">
                  <SelectValue placeholder="Select Model" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-white/10 text-white">
                  <SelectItem value="xgboost">XGBoost (Gradient Boosting)</SelectItem>
                  <SelectItem value="random_forest">Random Forest</SelectItem>
                  <SelectItem value="logistic_regression">Logistic Regression</SelectItem>
                  <SelectItem value="prophet">Prophet (Time Series)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between">
                  <label className="text-sm font-medium text-slate-300">Horizon</label>
                  <span className="text-sm font-mono text-indigo-400">{horizon[0]} Days</span>
              </div>
              <Slider
                value={horizon}
                onValueChange={setHorizon}
                max={30}
                step={1}
                min={1}
                className="py-4"
              />
            </div>

            <Button 
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-lg shadow-indigo-500/20 transition-all" 
                onClick={fetchPrediction}
                disabled={loading}
            >
                {loading ? <Activity className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4" />}
                Run Forecast
            </Button>
          </CardContent>
        </Card>

        {/* Main Chart */}
        <Card className="lg:col-span-9 bg-zinc-900/50 border-white/10 backdrop-blur-sm overflow-hidden">
            <CardHeader className="border-b border-white/5">
                <CardTitle className="flex items-center gap-2 text-white">
                    <Calendar className="w-5 h-5 text-indigo-400" />
                    Market Trend & AI Forecast
                </CardTitle>
            </CardHeader>
            <CardContent className="p-6 h-[500px]">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <defs>
                            <linearGradient id="colorClose" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                            </linearGradient>
                            <linearGradient id="colorForecast" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                        <XAxis 
                            dataKey="Date" 
                            stroke="#71717a" 
                            tick={{fontSize: 12}}
                            tickFormatter={(str) => {
                                const d = new Date(str);
                                return `${d.getDate()}/${d.getMonth() + 1}`;
                            }}
                            minTickGap={30}
                        />
                        <YAxis 
                            stroke="#71717a" 
                            domain={['auto', 'auto']} 
                            tickFormatter={(val) => `$${val.toFixed(0)}`}
                            orientation="right"
                            tick={{fontSize: 12}}
                        />
                        <Tooltip 
                            contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', color: '#fff' }}
                            itemStyle={{ color: '#e4e4e7' }}
                            labelStyle={{ color: '#a1a1aa' }}
                            formatter={(value: number) => [`$${value.toFixed(2)}`, 'Price']}
                            labelFormatter={(label) => new Date(label).toLocaleDateString(undefined, { dateStyle: 'full' })}
                        />
                        <Area 
                            type="monotone" 
                            dataKey="Close" 
                            stroke="#6366f1" 
                            strokeWidth={2} 
                            fillOpacity={1} 
                            fill="url(#colorClose)" 
                        />
                        <Area 
                            type="monotone" 
                            dataKey="Forecast" 
                            stroke="#10b981" 
                            strokeWidth={2} 
                            strokeDasharray="4 4" 
                            fillOpacity={1} 
                            fill="url(#colorForecast)" 
                        />
                        <ReferenceLine x={history[history.length - 1]?.Date} stroke="#fbbf24" strokeDasharray="3 3" label={{ value: "Today", position: 'insideTopLeft', fill: '#fbbf24', fontSize: 12 }} />
                    </ComposedChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>

        {/* Metrics Row */}
        {prediction && (
            <div className="lg:col-span-12 grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Probability Card */}
                <Card className="bg-zinc-900/50 border-white/10">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-slate-400 uppercase tracking-wider">Confidence Level</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-end justify-between mb-4">
                            <span className={`text-4xl font-black tracking-tighter ${prediction.direction === 'UP' ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {prediction.direction}
                            </span>
                            <span className="text-xl font-bold text-white">{(prediction.probability * 100).toFixed(1)}%</span>
                        </div>
                        <Progress 
                            value={prediction.probability * 100} 
                            className={`h-3 bg-slate-800 ${prediction.direction === 'UP' ? 'text-emerald-500' : 'text-rose-500'}`} 
                            indicatorClassName={prediction.direction === 'UP' ? 'bg-emerald-500' : 'bg-rose-500'}
                        />
                    </CardContent>
                </Card>

                {/* Feature Importance */}
                <Card className="md:col-span-2 bg-zinc-900/50 border-white/10">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-white">
                            <BarChart3 className="w-5 h-5 text-indigo-400" />
                            Feature Importance Analysis
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {prediction.feature_importance && Object.keys(prediction.feature_importance).length > 0 ? (
                                Object.entries(prediction.feature_importance).map(([feature, importance], idx) => (
                                    <div key={feature} className="group">
                                        <div className="flex items-center justify-between text-sm mb-1">
                                            <span className="text-slate-300 font-medium">{feature}</span>
                                            <span className="text-slate-500 group-hover:text-indigo-400 transition-colors">{importance.toFixed(4)}</span>
                                        </div>
                                        <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                                            <div 
                                                className="h-full bg-indigo-500/80 group-hover:bg-indigo-500 transition-all duration-500" 
                                                style={{ width: `${Math.min(Math.abs(importance) * 100 * 2, 100)}%` }} // Scale for visibility
                                            />
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="flex flex-col items-center justify-center h-32 text-slate-500 space-y-2">
                                    <Activity className="w-8 h-8 opacity-20" />
                                    <p>Feature importance not available for {model.replace('_', ' ')}.</p>
                                    <p className="text-xs opacity-50">Try XGBoost or Random Forest for explainability.</p>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        )}
      </div>
    </div>
  )
}
