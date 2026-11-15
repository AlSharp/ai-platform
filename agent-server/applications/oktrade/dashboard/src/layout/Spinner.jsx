import { useAppState } from "@/context/appState";
import { LoadingOverlay } from '@mantine/core';

export default function Spinner() {

  const [appState] = useAppState();

  return (
    <LoadingOverlay
        visible={appState.screenLoading}
        zIndex={1000}
        overlayProps={{ radius: "sm", blur: 2 }}
      />
  )
}