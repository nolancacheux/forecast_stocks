"use client"

import { useState, useEffect, useMemo } from "react"
import { useTheme } from "next-themes"
import { 
    Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter 
} from "@/components/ui/card"
import { 
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

import { 
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
    ReferenceLine, Area, ComposedChart, Legend 
} from 'recharts'
import { 
    Activity, Zap, BarChart3, TrendingUp, Calendar as CalendarIcon, 
    Layers, History, Settings, Bell, Search, LayoutDashboard, 
    ArrowUpRight, ArrowDownRight, ChevronRight, Info, Moon, Sun
} from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"

// --- Types ---
type Prediction = {
  ticker: string
  model: string
  direction: string
  probability: number
  feature_importance?: Record<string, number>
  forecast_dates?: string[]
  forecast_values?: number[]
  predicted_price?: number
  confidence_interval?: [number, number][] 
  metrics?: {
      accuracy: number
      precision: number
      recall: number
      model_type: string
  }
}

type HistoryItem = {
    Date: string
    Close: number
    Open: number
    High: number
    Low: number
    Volume: number
}

// --- Constants ---
const FEATURE_NAMES: Record<string, string> = {
    "RSI": "RSI (14)",
    "EMA_20": "EMA (20)",
    "EMA_50": "EMA (50)",
    "MACD_12_26_9": "MACD",
    "ISB_26": "Ichimoku Span B",
    "ITS_9": "Ichimoku Tenkan",
    "IKS_26": "Ichimoku Kijun",
    "ICS_26": "Ichimoku Chikou",
    "BBU_5_2.0": "Bollinger Upper",
    "BBL_5_2.0": "Bollinger Lower",
    "ATRr_14": "ATR",
    "STOCHk_14_3_3": "Stoch %K",
    "ROC_10": "Rate of Change"
}

export default function Dashboard() {
  // --- State ---
  const [ticker, setTicker] = useState("SPY")
  const [model, setModel] = useState("xgboost")
  const [horizon, setHorizon] = useState([14])
  const [referenceDate, setReferenceDate] = useState<Date | undefined>(undefined)
  const [startDate, setStartDate] = useState<Date | undefined>(undefined)
  const [showCI, setShowCI] = useState(false)
  const [loading, setLoading] = useState(false)
  const [prediction, setPrediction] = useState<Prediction | null>(null)
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [activeTab, setActiveTab] = useState("dashboard")
  const { theme, setTheme } = useTheme()

  // --- Fetching ---
  const fetchPrediction = async () => {
    setLoading(true)
    try {
      const payload: any = {
          ticker,
          model,
          horizon: horizon[0]
      }
      if (referenceDate) {
          const offset = referenceDate.getTimezoneOffset()
          const adjustedDate = new Date(referenceDate.getTime() - (offset*60*1000))
          payload.reference_date = adjustedDate.toISOString().split('T')[0]
      }
      if (startDate) {
          const offset = startDate.getTimezoneOffset()
          const adjustedDate = new Date(startDate.getTime() - (offset*60*1000))
          payload.start_date = adjustedDate.toISOString().split('T')[0]
      }

      const res = await fetch("http://localhost:8000/api/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
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
      const res = await fetch(`http://localhost:8000/api/history?ticker=${ticker}&period=5y`)
      const data = await res.json()
      setHistory(data)
    } catch (error) {
      console.error("Failed to fetch history:", error)
    }
  }

  useEffect(() => {
    fetchHistory()
  }, [ticker])

  // --- Chart Data Prep ---
  const chartData = useMemo(() => {
      const data = history.map(h => ({
          Date: h.Date,
          Close: h.Close,
          Forecast: null,
          ci_lower: null,
          ci_upper: null,
          isForecast: false
      }));

      if (prediction?.forecast_dates && prediction?.forecast_values) {
          prediction.forecast_dates.forEach((d, i) => {
              const existingIndex = data.findIndex(item => item.Date === d);
              
              const forecastVal = prediction.forecast_values![i];
              const ci_lower = forecastVal * 0.98; 
              const ci_upper = forecastVal * 1.02;

              if (existingIndex !== -1) {
                  data[existingIndex].Forecast = forecastVal;
                  data[existingIndex].ci_lower = ci_lower;
                  data[existingIndex].ci_upper = ci_upper;
                  data[existingIndex].isForecast = true;
              } else {
                   data.push({
                      Date: d,
                      Close: null,
                      Forecast: forecastVal,
                      ci_lower: ci_lower,
                      ci_upper: ci_upper,
                      isForecast: true
                  })
              }
          })
      }
      return data.sort((a, b) => new Date(a.Date).getTime() - new Date(b.Date).getTime());
  }, [history, prediction]);

  // --- Layout ---
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex font-sans">
        {/* Sidebar */}
        <aside className="w-64 border-r border-zinc-800 bg-zinc-900/50 backdrop-blur-xl hidden md:flex flex-col">
            <div className="p-6 border-b border-zinc-800">
                <h2 className="text-2xl font-bold tracking-tighter text-white flex items-center gap-2">
                    <Activity className="text-emerald-500" />
                    StockPulse
                </h2>
                <p className="text-xs text-zinc-500 mt-1">Professional Forecast Engine</p>
            </div>
            <nav className="flex-1 p-4 space-y-2">
                <Button variant={activeTab === "dashboard" ? "secondary" : "ghost"} className="w-full justify-start" onClick={() => setActiveTab("dashboard")}>
                    <LayoutDashboard className="mr-2 h-4 w-4" /> Dashboard
                </Button>
                <Button variant={activeTab === "analysis" ? "secondary" : "ghost"} className="w-full justify-start" onClick={() => setActiveTab("analysis")}>
                    <BarChart3 className="mr-2 h-4 w-4" /> Analysis
                </Button>
                <Button variant={activeTab === "settings" ? "secondary" : "ghost"} className="w-full justify-start" onClick={() => setActiveTab("settings")}>
                    <Settings className="mr-2 h-4 w-4" /> Settings
                </Button>
            </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col max-h-screen overflow-hidden">
            {/* Topbar */}
            <header className="h-16 border-b border-zinc-800 flex items-center justify-between px-6 bg-zinc-900/50 backdrop-blur-md">
                <div className="flex items-center gap-4 text-zinc-500 text-sm">
                    <span className="flex items-center gap-1 hover:text-zinc-300 cursor-pointer">
                        SPY <span className="text-emerald-500 text-xs">+1.2%</span>
                    </span>
                    <Separator orientation="vertical" className="h-4" />
                    <span className="flex items-center gap-1 hover:text-zinc-300 cursor-pointer">
                        QQQ <span className="text-emerald-500 text-xs">+0.8%</span>
                    </span>
                </div>
                <div className="flex items-center gap-4">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-500" />
                        <input 
                            type="text" 
                            placeholder="Search assets..." 
                            className="bg-zinc-900 border border-zinc-800 rounded-full pl-9 pr-4 py-1.5 text-sm focus:outline-none focus:border-emerald-500 transition-colors w-64"
                        />
                    </div>
                    <Button size="icon" variant="ghost" className="text-zinc-400">
                        <Bell className="h-5 w-5" />
                    </Button>
                </div>
            </header>

            {/* Scrollable Area */}
            <ScrollArea className="flex-1 p-6">
                <div className="max-w-7xl mx-auto space-y-8">
                    {activeTab === "dashboard" && (
                        <>
                            {/* Header Stats */}
                            <div className="flex justify-between items-end">
                                <div>
                                    <h1 className="text-3xl font-bold text-white mb-2">{ticker} Forecast Analysis</h1>
                                    <div className="flex items-center gap-2 text-sm text-zinc-400">
                                        <span>Model: <span className="text-zinc-200 capitalize">{model.replace('_', ' ')}</span></span>
                                        <Separator orientation="vertical" className="h-4" />
                                        <span>Horizon: <span className="text-zinc-200">{horizon[0]} Days</span></span>
                                        {referenceDate && (
                                            <>
                                                <Separator orientation="vertical" className="h-4" />
                                                <Badge variant="outline" className="border-amber-500/50 text-amber-500">Backtest Mode: {format(referenceDate, "MMM d, yyyy")}</Badge>
                                            </>
                                        )}
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <Button variant="outline" onClick={() => setShowCI(!showCI)} className={cn(showCI && "bg-zinc-800 border-zinc-700")}>
                                        {showCI ? "Hide" : "Show"} Confidence
                                    </Button>
                                    <Button onClick={fetchPrediction} disabled={loading} className="bg-emerald-600 hover:bg-emerald-500 text-white">
                                        {loading ? <Activity className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4" />}
                                        Run Forecast
                                    </Button>
                                </div>
                            </div>

                            {/* Main Grid */}
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                                {/* Left Col: Controls & Metrics */}
                                <div className="lg:col-span-3 space-y-6">
                                    {/* Configuration Card */}
                                    <Card className="bg-zinc-900 border-zinc-800 shadow-none">
                                        <CardHeader className="pb-3">
                                            <CardTitle className="text-base font-medium text-zinc-200">Settings</CardTitle>
                                        </CardHeader>
                                        <CardContent className="space-y-4">
                                            <div className="space-y-2">
                                                <label className="text-xs font-medium text-zinc-500 uppercase">Asset</label>
                                                <Select value={ticker} onValueChange={setTicker}>
                                                    <SelectTrigger className="bg-zinc-950 border-zinc-800 text-zinc-200">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent className="bg-zinc-900 border-zinc-800">
                                                        <SelectItem value="SPY">SPY (S&P 500)</SelectItem>
                                                        <SelectItem value="QQQ">QQQ (Nasdaq)</SelectItem>
                                                        <SelectItem value="IWM">IWM (Russell 2000)</SelectItem>
                                                        <SelectItem value="DIA">DIA (Dow Jones)</SelectItem>
                                                        <SelectItem value="NVDA">NVDA (NVIDIA)</SelectItem>
                                                        <SelectItem value="AAPL">AAPL (Apple)</SelectItem>
                                                        <SelectItem value="MSFT">MSFT (Microsoft)</SelectItem>
                                                        <SelectItem value="TSLA">TSLA (Tesla)</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            
                                            <div className="space-y-2">
                                                <label className="text-xs font-medium text-zinc-500 uppercase">Engine</label>
                                                <Select value={model} onValueChange={setModel}>
                                                    <SelectTrigger className="bg-zinc-950 border-zinc-800 text-zinc-200">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent className="bg-zinc-900 border-zinc-800">
                                                        <SelectItem value="xgboost">XGBoost</SelectItem>
                                                        <SelectItem value="random_forest">Random Forest</SelectItem>
                                                        <SelectItem value="logistic_regression">Logistic Regression</SelectItem>
                                                        <SelectItem value="prophet">Prophet</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            <div className="space-y-2">
                                                <label className="text-xs font-medium text-zinc-500 uppercase">Start Training From</label>
                                                <Popover>
                                                    <PopoverTrigger asChild>
                                                        <Button variant="outline" className="w-full justify-start text-left font-normal bg-zinc-950 border-zinc-800 text-zinc-300">
                                                            <CalendarIcon className="mr-2 h-4 w-4 text-zinc-500" />
                                                            {startDate ? format(startDate, "MMM d, yyyy") : "Data Inception"}
                                                        </Button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-auto p-0 bg-zinc-900 border-zinc-800" align="start">
                                                        <Calendar mode="single" selected={startDate} onSelect={setStartDate} initialFocus className="bg-zinc-900 text-white" />
                                                    </PopoverContent>
                                                </Popover>
                                            </div>

                                            <div className="space-y-2">
                                                <label className="text-xs font-medium text-zinc-500 uppercase">Prediction Point (Backtest)</label>
                                                <Popover>
                                                    <PopoverTrigger asChild>
                                                        <Button variant="outline" className="w-full justify-start text-left font-normal bg-zinc-950 border-zinc-800 text-zinc-300">
                                                            <CalendarIcon className="mr-2 h-4 w-4 text-zinc-500" />
                                                            {referenceDate ? format(referenceDate, "MMM d, yyyy") : "Today (Live)"}
                                                        </Button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-auto p-0 bg-zinc-900 border-zinc-800" align="start">
                                                        <Calendar mode="single" selected={referenceDate} onSelect={setReferenceDate} initialFocus className="bg-zinc-900 text-white" />
                                                    </PopoverContent>
                                                </Popover>
                                                {referenceDate && <Button variant="link" className="h-auto p-0 text-xs text-emerald-500" onClick={() => setReferenceDate(undefined)}>Reset to Live</Button>}
                                            </div>

                                            <div className="space-y-2">
                                                <div className="flex justify-between text-xs">
                                                    <span className="text-zinc-500">Horizon</span>
                                                    <span className="text-zinc-300">{horizon[0]} Days</span>
                                                </div>
                                                <Slider value={horizon} onValueChange={setHorizon} max={60} step={1} min={1} className="py-2" />
                                            </div>
                                        </CardContent>
                                    </Card>

                                    {/* Feature Importance Mini */}
                                    <Card className="bg-zinc-900 border-zinc-800 shadow-none h-full min-h-[300px]">
                                        <CardHeader className="pb-3">
                                            <CardTitle className="text-base font-medium text-zinc-200">Key Drivers</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            {prediction?.feature_importance ? (
                                                <div className="space-y-3">
                                                    {Object.entries(prediction.feature_importance).slice(0, 5).map(([k, v]) => (
                                                        <div key={k} className="text-sm">
                                                            <div className="flex justify-between mb-1">
                                                                <span className="text-zinc-400 text-xs">{FEATURE_NAMES[k] || k}</span>
                                                                <span className="text-emerald-500 font-mono text-xs">{(v).toFixed(3)}</span>
                                                            </div>
                                                            <Progress value={Math.abs(v) * 100 * 5} className="h-1 bg-zinc-800" indicatorClassName="bg-emerald-600" />
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center justify-center h-40 text-zinc-600">
                                                    <BarChart3 className="h-8 w-8 mb-2 opacity-20" />
                                                    <p className="text-xs">No feature data</p>
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
        </div>

                                {/* Center & Right: Chart & Stats */}
                                <div className="lg:col-span-9 space-y-6">
                                    {/* Chart */}
                                    <Card className="bg-zinc-900 border-zinc-800 shadow-none p-1">
                                        <CardContent className="p-0 h-[500px] relative">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                                                    <defs>
                                                        <linearGradient id="fillForecast" x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2}/>
                                                            <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                                                        </linearGradient>
                                                    </defs>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                                                    <XAxis 
                                                        dataKey="Date" 
                                                        stroke="#52525b" 
                                                        tick={{fontSize: 12}} 
                                                        tickFormatter={(str) => {
                                                            const d = new Date(str);
                                                            return `${d.getDate()}/${d.getMonth()+1}`;
                                                        }}
                                                        minTickGap={50}
                                                    />
                                                    <YAxis 
                                                        domain={['auto', 'auto']} 
                                                        orientation="right" 
                                                        stroke="#52525b" 
                                                        tick={{fontSize: 12}}
                                                        tickFormatter={(val) => `$${val.toFixed(0)}`}
                                                    />
                                                    <Tooltip 
                                                        contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', color: '#fff' }}
                                                        labelFormatter={(l) => format(new Date(l), "EEE, MMM d, yyyy")}
                                                    />
                                                    <Legend verticalAlign="top" height={36} />
                                                    
                                                    <Line 
                                                        type="monotone" 
                                                        dataKey="Close" 
                                                        name="Historical Price" 
                                                        stroke="#3b82f6" 
                                                        strokeWidth={2} 
                                                        dot={false} 
                                                    />
                                                    
                                                    <Line 
                                                        type="monotone" 
                                                        dataKey="Forecast" 
                                                        name="AI Prediction" 
                                                        stroke="#f59e0b" 
                                                        strokeWidth={2} 
                                                        strokeDasharray="5 5"
                                                        dot={false}
                                                        connectNulls
                                                    />
                                                    
                                                    {showCI && (
                                                        <>
                                                            <Area 
                                                                type="monotone" 
                                                                dataKey="ci_upper" 
                                                                stroke="none" 
                                                                fill="#f59e0b" 
                                                                fillOpacity={0.1} 
                                                            />
                                                        </>
                                                    )}
                                                    {prediction?.forecast_dates && (
                                                        <ReferenceLine x={prediction.forecast_dates[0]} stroke="#71717a" strokeDasharray="3 3" label={{ value: "Forecast Start", position: "insideTopLeft", fill: "#71717a", fontSize: 10 }} />
                                                    )}
                                                </ComposedChart>
                                            </ResponsiveContainer>
                                        </CardContent>
                                    </Card>

                                    {/* Bottom Stats */}
                                    {prediction && (
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                            <Card className="bg-zinc-900 border-zinc-800 shadow-none">
                                                <CardHeader className="pb-2">
                                                    <CardTitle className="text-xs font-medium text-zinc-500 uppercase">Direction Signal</CardTitle>
                                                </CardHeader>
                                                <CardContent>
                                                    <div className="flex items-center gap-3">
                                                        {prediction.direction === "UP" ? (
                                                            <ArrowUpRight className="h-8 w-8 text-emerald-500" />
                                                        ) : (
                                                            <ArrowDownRight className="h-8 w-8 text-rose-500" />
                                                        )}
                                                        <div>
                                                            <div className={cn("text-2xl font-bold", prediction.direction === "UP" ? "text-emerald-500" : "text-rose-500")}>
                                                                {prediction.direction === "UP" ? "BULLISH" : "BEARISH"}
                                                            </div>
                                                            <p className="text-xs text-zinc-500">{(prediction.probability * 100).toFixed(1)}% Confidence</p>
                                                        </div>
                                                    </div>
                                                    <Progress value={prediction.probability * 100} className="h-1.5 mt-4 bg-zinc-800" indicatorClassName={prediction.direction === "UP" ? "bg-emerald-500" : "bg-rose-500"} />
                                                </CardContent>
                                            </Card>

                                            <Card className="bg-zinc-900 border-zinc-800 shadow-none">
                                                <CardHeader className="pb-2">
                                                    <CardTitle className="text-xs font-medium text-zinc-500 uppercase">Forecast Target</CardTitle>
                                                </CardHeader>
                                                <CardContent>
                                                    <div className="text-2xl font-bold text-zinc-200">
                                                        {prediction.predicted_price ? `$${prediction.predicted_price.toFixed(2)}` : "N/A"}
                                                    </div>
                                                    <p className="text-xs text-zinc-500 mt-1">Expected price in {horizon[0]} days</p>
                                                </CardContent>
                                            </Card>
                                            
                                            <Card className="bg-zinc-900 border-zinc-800 shadow-none">
                                                <CardHeader className="pb-2">
                                                    <CardTitle className="text-xs font-medium text-zinc-500 uppercase">Validation Metrics</CardTitle>
                                                </CardHeader>
                                                <CardContent>
                                                    {prediction.metrics ? (
                                                        <div className="space-y-2">
                                                            <div className="flex justify-between text-sm">
                                                                <span className="text-zinc-400">Accuracy</span>
                                                                <span className="text-zinc-200">{(prediction.metrics.accuracy * 100).toFixed(1)}%</span>
                                                            </div>
                                                            <div className="flex justify-between text-sm">
                                                                <span className="text-zinc-400">Precision</span>
                                                                <span className="text-zinc-200">{(prediction.metrics.precision * 100).toFixed(1)}%</span>
                                                            </div>
                                                            <div className="flex justify-between text-sm">
                                                                <span className="text-zinc-400">Recall</span>
                                                                <span className="text-zinc-200">{(prediction.metrics.recall * 100).toFixed(1)}%</span>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="text-2xl font-bold text-zinc-200">N/A</div>
                                                    )}
                                                </CardContent>
                                            </Card>
                                        </div>
                                    )}
                                    
                                     {/* Market Data Table */}
                                     <Card className="bg-zinc-900 border-zinc-800 shadow-none">
                                        <CardHeader>
                                            <CardTitle className="text-base font-medium text-zinc-200">Recent Market Data</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <Table>
                                                <TableHeader>
                                                    <TableRow className="border-zinc-800 hover:bg-zinc-900">
                                                        <TableHead className="text-zinc-500">Date</TableHead>
                                                        <TableHead className="text-zinc-500">Close</TableHead>
                                                        <TableHead className="text-zinc-500">Open</TableHead>
                                                        <TableHead className="text-zinc-500">Volume</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {history.slice(-5).reverse().map((row) => (
                                                        <TableRow key={row.Date} className="border-zinc-800 hover:bg-zinc-800/50">
                                                            <TableCell className="font-medium text-zinc-300">{row.Date}</TableCell>
                                                            <TableCell className="text-zinc-400">${row.Close.toFixed(2)}</TableCell>
                                                            <TableCell className="text-zinc-400">${row.Open.toFixed(2)}</TableCell>
                                                            <TableCell className="text-zinc-400">{(row.Volume / 1000000).toFixed(1)}M</TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </CardContent>
                                     </Card>
                                </div>
                            </div>
                        </>
                    )}

                    {activeTab === "settings" && (
                        <Card className="bg-zinc-900 border-zinc-800">
                            <CardHeader>
                                <CardTitle className="text-white">Settings</CardTitle>
                                <CardDescription>Manage your preferences</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="space-y-0.5">
                                        <label className="text-base font-medium text-white">Theme Mode</label>
                                        <p className="text-sm text-zinc-500">Switch between light and dark mode</p>
                                    </div>
                                    <Button variant="outline" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
                                        {theme === "dark" ? <Sun className="h-4 w-4 mr-2" /> : <Moon className="h-4 w-4 mr-2" />}
                                        Toggle Theme
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    )}
        </div>
            </ScrollArea>
      </main>
    </div>
  )
}
