-- MySQL dump 10.13  Distrib 8.0.18, for Win64 (x86_64)
--
-- Host: 127.0.0.1    Database: forest_db
-- ------------------------------------------------------
-- Server version	8.0.18

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `django_migrations`
--

DROP TABLE IF EXISTS `django_migrations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `django_migrations` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `app` varchar(255) NOT NULL,
  `name` varchar(255) NOT NULL,
  `applied` datetime(6) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=35 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `django_migrations`
--

LOCK TABLES `django_migrations` WRITE;
/*!40000 ALTER TABLE `django_migrations` DISABLE KEYS */;
INSERT INTO `django_migrations` VALUES (1,'agri','0001_initial','2026-04-11 21:31:30.610946'),(2,'agri','0002_farmplot_terrain_id','2026-04-11 21:31:30.621940'),(3,'contenttypes','0001_initial','2026-04-11 21:31:30.629941'),(4,'contenttypes','0002_remove_content_type_name','2026-04-11 21:31:30.638736'),(5,'auth','0001_initial','2026-04-11 21:31:30.652521'),(6,'auth','0002_alter_permission_name_max_length','2026-04-11 21:31:30.658757'),(7,'auth','0003_alter_user_email_max_length','2026-04-11 21:31:30.669790'),(8,'auth','0004_alter_user_username_opts','2026-04-11 21:31:30.681050'),(9,'auth','0005_alter_user_last_login_null','2026-04-11 21:31:30.692697'),(10,'auth','0006_require_contenttypes_0002','2026-04-11 21:31:30.697184'),(11,'auth','0007_alter_validators_add_error_messages','2026-04-11 21:31:30.706845'),(12,'auth','0008_alter_user_username_max_length','2026-04-11 21:31:30.717730'),(13,'auth','0009_alter_user_last_name_max_length','2026-04-11 21:31:30.726827'),(14,'auth','0010_alter_group_name_max_length','2026-04-11 21:31:30.738576'),(15,'auth','0011_update_proxy_permissions','2026-04-11 21:31:30.745811'),(16,'auth','0012_alter_user_first_name_max_length','2026-04-11 21:31:30.756069'),(17,'federation','0001_initial','2026-04-11 21:31:30.767605'),(18,'federation','0002_federationqueryrecord_requester_id','2026-04-11 21:31:30.773899'),(19,'fleet','0001_initial','2026-04-11 21:31:30.782612'),(20,'forest','0001_initial','2026-04-11 21:31:30.910706'),(21,'forest','0002_forestarea_terrain_id','2026-04-11 21:31:30.952376'),(22,'sessions','0001_initial','2026-04-11 21:31:30.960154'),(23,'system','0001_initial','2026-04-11 21:31:30.973195'),(24,'system','0002_alter_rolepermission_options_and_more','2026-04-11 21:31:31.011206'),(25,'tasking','0001_initial','2026-04-11 21:31:31.021325'),(26,'telemetry','0001_initial','2026-04-11 21:31:31.033821'),(27,'terrain','0001_initial','2026-04-11 21:31:31.047493'),(28,'terrain','0002_delete_terrainfeature_delete_terraintype_and_more','2026-04-14 10:26:30.604614'),(29,'terrain','0003_terrainplot','2026-04-14 10:26:30.612550'),(30,'terrain','0004_terrainarea_terrainelement_terrainzone_and_more','2026-04-14 10:26:30.624459'),(31,'terrain','0005_terrainsubcategory','2026-04-14 10:26:30.630950'),(32,'terrain','0006_terrainarea_is_deleted_alter_terrainarea_type_and_more','2026-04-14 10:26:30.642719'),(33,'terrain','0007_terrainsubcategory_is_default_and_more','2026-04-16 22:30:43.672703'),(34,'terrain','0008_alter_terrainelement_options_and_more','2026-04-16 22:30:43.689600');
/*!40000 ALTER TABLE `django_migrations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `forest_area`
--

DROP TABLE IF EXISTS `forest_area`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `forest_area` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `area_code` varchar(64) NOT NULL,
  `area_name` varchar(128) NOT NULL,
  `region` varchar(128) NOT NULL,
  `risk_level` varchar(32) NOT NULL,
  `coverage_km2` decimal(10,2) NOT NULL,
  `manager_name` varchar(64) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `terrain_id` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `area_code` (`area_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `forest_area`
--

LOCK TABLES `forest_area` WRITE;
/*!40000 ALTER TABLE `forest_area` DISABLE KEYS */;
/*!40000 ALTER TABLE `forest_area` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `forest_fire_detection`
--

DROP TABLE IF EXISTS `forest_fire_detection`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `forest_fire_detection` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `patrol_task_id` bigint(20) NOT NULL,
  `forest_area_id` bigint(20) NOT NULL,
  `alert_level` varchar(32) NOT NULL,
  `fire_status` varchar(32) NOT NULL,
  `longitude` decimal(10,6) NOT NULL,
  `latitude` decimal(10,6) NOT NULL,
  `heat_score` decimal(8,2) NOT NULL,
  `detected_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `forest_fire_detection`
--

LOCK TABLES `forest_fire_detection` WRITE;
/*!40000 ALTER TABLE `forest_fire_detection` DISABLE KEYS */;
/*!40000 ALTER TABLE `forest_fire_detection` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `forest_patrol_task`
--

DROP TABLE IF EXISTS `forest_patrol_task`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `forest_patrol_task` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `task_code` varchar(64) NOT NULL,
  `global_task_id` bigint(20) NOT NULL,
  `area_id` bigint(20) NOT NULL,
  `drone_group_id` bigint(20) NOT NULL,
  `patrol_type` varchar(32) NOT NULL,
  `status` varchar(32) NOT NULL,
  `planned_start` datetime(6) DEFAULT NULL,
  `planned_end` datetime(6) DEFAULT NULL,
  `created_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `task_code` (`task_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `forest_patrol_task`
--

LOCK TABLES `forest_patrol_task` WRITE;
/*!40000 ALTER TABLE `forest_patrol_task` DISABLE KEYS */;
/*!40000 ALTER TABLE `forest_patrol_task` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping events for database 'forest_db'
--

--
-- Dumping routines for database 'forest_db'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-04-28 23:01:01
