import React, {useEffect} from 'react';
import {
  Alert,
  Button,
  SafeAreaView,
  ScrollView,
  StatusBar,
  Text,
} from 'react-native';

import Instabug, {InvocationEvent, NetworkLogger} from 'instabug-reactnative';
import NetInfo from '@react-native-community/netinfo';
import config from './config';

function App(): React.JSX.Element {
  NetInfo.configure({});

  useEffect(() => {
    if (!config.instabugToken) {
      console.warn('Instabug token is missing');
    }
    Instabug.init({
      token: config.instabugToken,
      invocationEvents: [InvocationEvent.twoFingersSwipe],
    });
    console.log('Initialized Instabug');
  }, []);

  useEffect(() => {
    // Performs the request to NetInfo
    NetInfo.fetch();
  }, []);

  return (
    <SafeAreaView
      style={{
        flex: 1,
        backgroundColor: 'white',
      }}
    >
      <StatusBar barStyle={'dark-content'} backgroundColor="white" />
      <ScrollView
        contentContainerStyle={{
          alignItems: 'center',
          paddingHorizontal: 24,
        }}
        style={{
          flex: 1,
          backgroundColor: 'white',
        }}
      >
        <Text
          style={{
            marginBottom: 12,
          }}
        >
          Network Logger issue report
        </Text>

        <Text
          style={{
            marginBottom: 12,
          }}
        >
          __DEV__: {`${__DEV__}`}
        </Text>

        {__DEV__ ? (
          <Text style={{textAlign: 'center', marginBottom: 12}}>
            ❗️ You are running the debug build. To see the error being logged
            while in __DEV__ make sure the patch on the patches folder with logs
            was applied after `npm install`. If not, you can apply it manually.
          </Text>
        ) : null}

        {config.instabugToken ? null : (
          <Text style={{color: 'red', textAlign: 'center', marginBottom: 12}}>
            Instabug token is missing in config.ts
          </Text>
        )}

        <Button
          title="Show instabug"
          onPress={() => {
            Instabug.show();
          }}
        />

        <Button
          title="Enable network logger"
          onPress={() => {
            NetworkLogger.setEnabled(true);
            Alert.alert('Network logger enabled');
          }}
        />

        <Button
          title="Disable network logger"
          onPress={() => {
            NetworkLogger.setEnabled(false);
            Alert.alert('Network logger disabled');
          }}
        />

        <Button
          title="Simulate first request from NetInfo"
          onPress={async () => {
            try {
              // By recalling .configure we are resetting the state of the NetInfo
              // and simulating the first request after configure which is
              // guaranteed to reproduce the error.
              NetInfo.configure({});

              await NetInfo.fetch();
            } catch (error: any) {
              // This wont catch the error being reported. Because the actual error is unhandled.
              // This catch block is here only to demonstrate that you can't catch it,
              // otherwise we would see it.
              console.error('Error checking network state', error);
              Alert.alert(
                'Error checking network state',
                error?.message || 'Something went wrong',
              );
            }
          }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

export default App;
