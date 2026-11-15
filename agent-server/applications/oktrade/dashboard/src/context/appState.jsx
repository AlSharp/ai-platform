import { createContext, useContext, useEffect } from "react";
import { useMergeState } from "../lib/hooks";

const AppStateContext = createContext();

export const AppStateProvider = ({ children }) => {

  const initialState = {
    accounts: [],
    strategies: [],
    strategyFiles: [],
    liveTradingClients: [],
    journals: [],
    reports: [],
    sectionLoading: false,
    screenLoading: false
  }

  const [appState, setAppState] = useMergeState(initialState);

  useEffect(() => {
    console.log('APPSTATE UPDATED: ', appState);
  }, [appState])

  return (
    <AppStateContext.Provider value={[ appState, setAppState ]}>{children}</AppStateContext.Provider>
  )

}

export const useAppState = () => {
  return useContext(AppStateContext);
}