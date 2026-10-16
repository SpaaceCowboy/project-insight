package com.insightpuzzle.app;

import android.content.Context;
import androidx.annotation.NonNull;
import androidx.room.Dao;
import androidx.room.Database;
import androidx.room.Entity;
import androidx.room.Insert;
import androidx.room.OnConflictStrategy;
import androidx.room.PrimaryKey;
import androidx.room.Query;
import androidx.room.Room;
import androidx.room.RoomDatabase;
import java.util.List;

/** Private, account-partitioned cache/outbox. All calls run on Dispatchers.IO. */
@Database(entities = {OnlineDatabase.Pending.class, OnlineDatabase.Record.class}, version = 1, exportSchema = false)
public abstract class OnlineDatabase extends RoomDatabase {
    @Entity(tableName = "pending", primaryKeys = {"account", "id"})
    public static class Pending {
        @NonNull public String id = "";
        @NonNull public String account = "";
        @NonNull public String endpoint = "";
        @NonNull public String payload = "";
        @NonNull public String state = "pending";
        @NonNull public String error = "";
        public long createdAt;
    }
    @Entity(tableName = "records", primaryKeys = {"account", "key"})
    public static class Record {
        @NonNull public String account = "";
        @NonNull public String key = "";
        @NonNull public String value = "";
    }
    @Dao
    public interface Queries {
        @Insert(onConflict = OnConflictStrategy.IGNORE) void enqueue(Pending operation);
        @Query("SELECT * FROM pending WHERE account=:account AND state='pending' ORDER BY createdAt,id LIMIT 100") List<Pending> pending(String account);
        @Query("SELECT * FROM pending WHERE account=:account ORDER BY CASE WHEN state='failed' THEN 0 ELSE 1 END,createdAt DESC LIMIT 100") List<Pending> outcomes(String account);
        @Query("DELETE FROM pending WHERE account=:account AND id=:id") void acknowledge(String account, String id);
        @Query("UPDATE pending SET state='failed',error=:error WHERE account=:account AND id=:id") void fail(String account, String id, String error);
        @Insert(onConflict = OnConflictStrategy.REPLACE) void save(Record record);
        @Query("SELECT value FROM records WHERE account=:account AND `key`=:key") String read(String account, String key);
        @Query("DELETE FROM records WHERE account=:account AND `key`=:key") void remove(String account, String key);
    }
    public abstract Queries queries();
    private static volatile OnlineDatabase instance;
    public static OnlineDatabase get(Context context) {
        if (instance == null) synchronized (OnlineDatabase.class) {
            if (instance == null) instance = Room.databaseBuilder(context.getApplicationContext(), OnlineDatabase.class, BuildConfig.ONLINE_DEMO ? "online-preview.db" : "online.db").build();
        }
        return instance;
    }
}
