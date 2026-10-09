# ShakaEaseLiveWithAdapter
Shaka player integration with ease live sdk with free test account

## Ad demos

The ad-enabled player has two brand configurations:

- `?brand=ads-skippable` uses Google's skippable test ad for the pre-roll,
  every mid-roll, and the post-roll.
- `?brand=ads-non-skippable` uses Google's non-skippable linear test ad for
  the pre-roll, every mid-roll, and the post-roll.

Both configurations display the scheduled ad breaks as amber markers on the
Shaka seek bar. The first and last markers represent the pre- and post-roll;
the other markers use `ads.midRoll.offsetsSec` from the selected brand file.
A marker disappears after its ad completes or is skipped and resets on reload.


<img width="912" height="562" alt="image" src="https://github.com/user-attachments/assets/6ed60e70-1697-4479-bc85-7417e8ef042f" />
