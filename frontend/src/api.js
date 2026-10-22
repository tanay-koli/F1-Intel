import axios from 'axios'

const api = axios.create({ baseURL: '/api', timeout: 20000 })
const telemetryApi = axios.create({ baseURL: '/api', timeout: 120000 }) // FastF1 first load can be slow

// The API returns {error, message} on failure. Put that message on the error so
// pages showing `error.message` display the reason instead of axios's
// "Request failed with status code 503". `error.status` / `error.code` stay usable.
function surfaceApiMessage(error) {
  const body = error.response?.data
  if (body?.message) {
    error.message = body.message
    error.apiCode = body.error
  }
  return Promise.reject(error)
}
api.interceptors.response.use(r => r, surfaceApiMessage)
telemetryApi.interceptors.response.use(r => r, surfaceApiMessage)

export const f1Api = {
  // Drivers
  getDrivers: (season) => api.get(`/drivers?season=${season}`).then(r => r.data),
  getDriverStandings: (season) => api.get(`/driver-standings?season=${season}`).then(r => r.data),
  getDriver: (id, season) => api.get(`/drivers/${id}?season=${season}`).then(r => r.data),
  getDriverProgression: (season) => api.get(`/driver-progression?season=${season}`).then(r => r.data),

  // Constructors
  getConstructors: (season) => api.get(`/constructors?season=${season}`).then(r => r.data),
  getConstructorStandings: (season) => api.get(`/constructor-standings?season=${season}`).then(r => r.data),
  getConstructor: (id, season) => api.get(`/constructors/${id}?season=${season}`).then(r => r.data),
  getConstructorProgression: (season) => api.get(`/constructor-progression?season=${season}`).then(r => r.data),

  // Races
  getSchedule: (season) => api.get(`/schedule?season=${season}`).then(r => r.data),
  getRaceResults: (season, round) => api.get(`/results?season=${season}&round=${round}`).then(r => r.data),
  getQualifying: (season, round) => api.get(`/qualifying?season=${season}&round=${round}`).then(r => r.data),

  // Home
  getNextRace: (season) => api.get(`/next-race?season=${season}`).then(r => r.data),
  getCircuitOutline: (circuitId, alt = '') =>
    api.get(`/circuit-outline?circuit_id=${encodeURIComponent(circuitId)}&alt=${encodeURIComponent(alt)}`).then(r => r.data),

  // Seasons
  getSeasons: () => api.get('/seasons').then(r => r.data),

  // Sprint
  getSprintResults: (season, round) => api.get(`/sprint?season=${season}&round=${round}`).then(r => r.data),


  // Head-to-Head
  getH2H: (season, driver1, driver2) => api.get(`/h2h?season=${season}&driver1=${driver1}&driver2=${driver2}`).then(r => r.data),
  getConstructorH2H: (season, c1, c2) =>
    api.get(`/h2h/constructors?season=${season}&constructor1=${c1}&constructor2=${c2}`).then(r => r.data),

  // Telemetry (FastF1)
  getTelemetryDrivers: (year, round, session) =>
    telemetryApi.get(`/telemetry/drivers?year=${year}&round=${round}&session=${session}`).then(r => r.data),
  getTelemetry: (year, round, session, driver1, driver2) =>
    telemetryApi.get(`/telemetry?year=${year}&round=${round}&session=${session}&driver1=${driver1}&driver2=${driver2}`).then(r => r.data),
  getRaceAnalysis: (year, round) =>
    telemetryApi.get(`/telemetry/race-analysis?year=${year}&round=${round}`).then(r => r.data),
  getRaceAnalyst: (year, round) =>
    telemetryApi.get(`/race-analyst?year=${year}&round=${round}`).then(r => r.data),
}

