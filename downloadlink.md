# Download

**Midori / INSIGHT Online 0.2.26 (version code 37)**

https://13.140.89.146/INSIGHT-online.apk?v=0.2.26

SHA-256: `00ac99d7f703222c956e970f920f4f2c061e23c19d173879cc53b2d81df83848`

## Notes

- Google sign-in is built in. The Web OAuth client ID is configured in both the app and the server.
- Google Cloud still needs an **Android OAuth client** for package `com.insightpuzzle.app` and signing SHA-1 `B9:1D:DA:64:02:61:F0:5F:E1:F3:89:90:AE:B7:F0:88:CE:A3:D2:D0`.
- Password reset by email is server-ready but hidden until SMTP credentials are added and `MAIL_DELIVERY_MODE=smtp` is set on the server.
- Guest Journey progress (solved levels, badges and the unfinished attempt) moves into the first account created on the device.
- The local preview APK is `INSIGHT-preview.apk`; it does not use accounts or Google.
