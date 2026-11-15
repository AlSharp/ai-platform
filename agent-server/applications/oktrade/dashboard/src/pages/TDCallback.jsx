import { useSearchParams } from "react-router-dom";
import { useEffect } from "react";
import { useLocalStorage } from "@mantine/hooks";

function TDCallback() {

  const [code, setCode] = useLocalStorage({
    key: 'code',
    defaultValue: ''
  });
  const [params] = useSearchParams();

  useEffect(() => {
    const code = params.get('code');
    setCode(code);
  }, [])

  useEffect(() => {
    window.close();
  }, [code])

  return null;
}

export default TDCallback;