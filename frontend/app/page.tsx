"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { ArrowUp, ArrowDown, Activity, Zap, BarChart3 } from "lucide-react"

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
      const res = await fetch(`http://localhost:8000/api/history?ticker=${ticker}&period=6mo`)
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
  const chartData = [...history]
  if (prediction?.forecast_dates && prediction?.forecast_values) {
      prediction.forecast_dates.forEach((date, i) => {
          chartData.push({
              Date: date,
              Forecast: prediction.forecast_values[i],
              isForecast: true
          })
      })
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-8">
      <header className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
            MarketFocus AI
          </h1>
          <p className="text-slate-400">Next-Gen Financial Prediction Dashboard</p>
        </div>
        <div className="flex gap-4">
            <Badge variant="outline" className="border-blue-500 text-blue-400">v1.0.0</Badge>
            <Badge variant={prediction?.direction === "UP" ? "default" : "destructive"}>
                Current Signal: {prediction?.direction || "WAITING"}
            </Badge>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        {/* Controls */}
        <Card className="bg-slate-900 border-slate-800 md:col-span-1">
          <CardHeader>
            <CardTitle>Configuration</CardTitle>
            <CardDescription>Set prediction parameters</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium">Asset (ETF)</label>
              <Select value={ticker} onValueChange={setTicker}>
                <SelectTrigger>
                  <SelectValue placeholder="Select ETF" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SPY">SPY (S&P 500)</SelectItem>
                  <SelectItem value="QQQ">QQQ (Nasdaq)</SelectItem>
                  <SelectItem value="IWM">IWM (Russell 2000)</SelectItem>
                  <SelectItem value="DIA">DIA (Dow Jones)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Model Engine</label>
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Model" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="xgboost">XGBoost Classifier</SelectItem>
                  <SelectItem value="random_forest">Random Forest</SelectItem>
                  <SelectItem value="logistic_regression">Logistic Regression</SelectItem>
                  <SelectItem value="prophet">Prophet (TimeSeries)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Horizon: {horizon[0]} Days</label>
              <Slider
                value={horizon}
                onValueChange={setHorizon}
                max={30}
                step={1}
                min={1}
              />
            </div>

            <Button 
                className="w-full bg-blue-600 hover:bg-blue-700" 
                onClick={fetchPrediction}
                disabled={loading}
            >
                {loading ? <Activity className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4" />}
                Run Prediction
            </Button>
          </CardContent>
        </Card>

        {/* Main Chart */}
        <Card className="bg-slate-900 border-slate-800 md:col-span-3">
            <CardHeader>
                <CardTitle>Price Trend & Forecast</CardTitle>
            </CardHeader>
            <CardContent className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis dataKey="Date" stroke="#94a3b8" tickFormatter={(str) => str ? str.slice(5) : ''} />
                        <YAxis stroke="#94a3b8" domain={['auto', 'auto']} />
                        <Tooltip 
                            contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#fff' }}
                        />
                        <Line type="monotone" dataKey="Close" stroke="#3b82f6" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="Forecast" stroke="#10b981" strokeWidth={2} strokeDasharray="5 5" />
                    </LineChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
      </div>

      {/* Metrics */}
      {prediction && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="bg-slate-900 border-slate-800">
                  <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-slate-400">Direction Probability</CardTitle>
                  </CardHeader>
                  <CardContent>
                      <div className="flex items-center justify-between mb-2">
                          <span className={`text-2xl font-bold ${prediction.direction === 'UP' ? 'text-green-500' : 'text-red-500'}`}>
                              {prediction.direction}
                          </span>
                          <span className="text-slate-400">{(prediction.probability * 100).toFixed(1)}%</span>
                      </div>
                      <Progress value={prediction.probability * 100} className="h-2" />
                  </CardContent>
              </Card>

              <Card className="bg-slate-900 border-slate-800 md:col-span-2">
                  <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                          <BarChart3 className="h-4 w-4" />
                          Feature Importance
                      </CardTitle>
                  </CardHeader>
                  <CardContent>
                      <div className="space-y-2">
                          {prediction.feature_importance ? (
                              Object.entries(prediction.feature_importance).map(([feature, importance]) => (
                                  <div key={feature} className="flex items-center justify-between text-sm">
                                      <span className="text-slate-300">{feature}</span>
                                      <div className="flex items-center gap-2 w-1/2">
                                          <Progress value={importance * 100} className="h-2" />
                                          <span className="text-xs text-slate-500">{importance.toFixed(3)}</span>
                                      </div>
                                  </div>
                              ))
                          ) : (
                              <p className="text-slate-500">Not available for this model.</p>
                          )}
                      </div>
                  </CardContent>
              </Card>
          </div>
      )}
    </div>
  )
}
