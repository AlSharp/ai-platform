import { createContext, useContext, useState, useEffect } from "react";
import { useFetch } from "@/lib/fetch";

const UIConfigContext = createContext();

export const UIConfigProvider = ({ children }) => {

  const _fetch = useFetch();

  const [config, setConfig] = useState(null);

  useEffect(() => {
    getConfig();
  }, []);

  const getConfig = async () => {
    try {
      const { data } = await _fetch('/uiconfig');
      const config = data.reduce((config, row) => {
        if (config[row.category]) {
          return { ...config, [row.category]: {
            ...config[row.category],
            [row.key]: row.value
          } }
        } else {
          return {
            ...config,
            [row.category]: {
              [row.key]: row.value
            }
          }
        }
      }, {});
      setConfig(config);
    }
    catch(error) {
      console.log('Could not load UI config');
    }
  }

  if (!config) return null;

  return (
    <UIConfigContext.Provider value={config}>{children}</UIConfigContext.Provider>
  )
}

export const useUIConfig = () => useContext(UIConfigContext);

export const useUIConfigSelector = (category, key) => {
  const config = useContext(UIConfigContext);

  return config[category]?.[key];
}